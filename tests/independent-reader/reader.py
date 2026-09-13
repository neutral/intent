#!/usr/bin/env python3
"""Independent, deliberately partial Knowledge reader using Python's stdlib."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
from dataclasses import dataclass


PROFILE = "intent.independent-reader.strict-integer.v2"
MAX_INTEGER = (1 << 53) - 1


class ReadingError(ValueError):
    def __init__(self, code: str, message: str, *, unsupported: bool = False):
        super().__init__(message)
        self.code = code
        self.unsupported = unsupported


@dataclass(frozen=True)
class Limits:
    record_bytes: int = 4_194_304
    front_matter_bytes: int = 524_288
    json_depth: int = 64
    json_nodes: int = 65_536

    def __post_init__(self):
        maxima = (4_194_304, 524_288, 64, 65_536)
        for value, maximum in zip(vars(self).values(), maxima):
            if type(value) is not int or not 0 < value <= maximum:
                raise ReadingError("limits", "Limits must be positive integers within the profile maxima")


def fingerprint(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def scalar_text(value: str) -> str:
    if any(0xD800 <= ord(char) <= 0xDFFF for char in value):
        raise ReadingError("json.unicode", "Unpaired Unicode surrogate")
    return value


def preflight_json(text: str, limits: Limits) -> None:
    """Bound containers and values before JSON decoding allocates the tree.

    This lexical pass does not accept syntax: the stdlib decoder still owns
    complete JSON syntax checking. For valid JSON it counts values exactly;
    property names are excluded and the root value has depth one.
    """
    cursor = 0
    containers: list[str] = []
    nodes = 0

    def value_node(depth: int) -> None:
        nonlocal nodes
        nodes += 1
        if nodes > limits.json_nodes:
            raise ReadingError("limit.json-nodes", "JSON node limit exceeded")
        if depth > limits.json_depth:
            raise ReadingError("limit.json-depth", "JSON depth limit exceeded")

    while cursor < len(text):
        char = text[cursor]
        if char in " \t\r\n,:":
            cursor += 1
        elif char in "[{":
            value_node(len(containers) + 1)
            containers.append(char)
            cursor += 1
        elif char in "]}":
            expected_opening = "[" if char == "]" else "{"
            if not containers or containers.pop() != expected_opening:
                raise ReadingError("json.syntax", "Unmatched JSON delimiter")
            cursor += 1
        elif char == '"':
            cursor += 1
            while cursor < len(text):
                if text[cursor] == "\\":
                    cursor += 2
                elif text[cursor] == '"':
                    cursor += 1
                    break
                else:
                    cursor += 1
            else:
                raise ReadingError("json.syntax", "Unterminated JSON string")
            following = cursor
            while following < len(text) and text[following] in " \t\r\n":
                following += 1
            if following == len(text) or text[following] != ":":
                value_node(len(containers) + 1)
        else:
            value_node(len(containers) + 1)
            while cursor < len(text) and text[cursor] not in " \t\r\n,]}:":
                cursor += 1
    if containers:
        raise ReadingError("json.syntax", "Unclosed JSON delimiter")


def strict_json(text: str, limits: Limits) -> dict:
    preflight_json(text, limits)

    def object_pairs(pairs: list[tuple[str, object]]) -> dict:
        result = {}
        for key, value in pairs:
            scalar_text(key)
            if key in result:
                raise ReadingError("json.duplicate-key", f"Duplicate decoded JSON key: {key!r}")
            result[key] = value
        return result

    def integer(token: str) -> int:
        if len(token.lstrip("-")) > 16:
            raise ReadingError("json.integer", "Integer exceeds the interoperable exact domain")
        result = int(token)
        if abs(result) > MAX_INTEGER:
            raise ReadingError("json.integer", "Integer exceeds the interoperable exact domain")
        return result

    def floating(token: str):
        raise ReadingError(
            "profile.float-unsupported",
            "Decimal and exponent number tokens are outside this reader's canonicalization profile",
            unsupported=True,
        )

    def constant(token: str):
        raise ReadingError("json.nonfinite", f"Non-JSON numeric constant: {token}")

    try:
        value = json.loads(text, object_pairs_hook=object_pairs, parse_int=integer,
                           parse_float=floating, parse_constant=constant)
    except json.JSONDecodeError as error:
        raise ReadingError("json.syntax", f"{error.msg} at line {error.lineno}, column {error.colno}") from error
    if not isinstance(value, dict):
        raise ReadingError("json.header-object", "Knowledge front matter must be one JSON object")

    def inspect(item):
        if isinstance(item, str):
            scalar_text(item)
        elif isinstance(item, list):
            for child in item:
                inspect(child)
        elif isinstance(item, dict):
            for child in item.values():
                inspect(child)

    inspect(value)
    return value


def normalize_context(context: dict, record_id: str) -> dict:
    """Select explicit owner data and normalize only documented sets."""
    if not isinstance(context, dict) or set(context) != {"catalog", "connections"}:
        raise ReadingError("context.required", "Supply explicit catalog and connections objects")
    catalog, connections = context["catalog"], context["connections"]
    kinds = ("relationships", "conflicts", "sourceUses", "coverage", "checkSelections")
    if not isinstance(catalog, dict) or catalog.get("schema") != "intent.catalog.v1" or not all(isinstance(catalog.get(key), list) for key in ("sources", "records")):
        raise ReadingError("context.shape", "Unsupported or incomplete catalog")
    if not isinstance(connections, dict) or connections.get("schema") != "intent.connections.v1" or not all(isinstance(connections.get(key), list) for key in kinds):
        raise ReadingError("context.shape", "Unsupported or incomplete connections")
    owner = lambda item: item.get("record") == record_id
    selected = {"catalog": {"schema": catalog["schema"], "records": copy.deepcopy([item for item in catalog["records"] if owner(item)]), "sources": []},
                "connections": {"schema": connections["schema"], **{kind: copy.deepcopy([item for item in connections[kind] if owner(item)]) for kind in kinds}}}
    if len(selected["catalog"]["records"]) != 1:
        raise ReadingError("context.registration", "Exactly one registration must select the record ID")
    used = {item.get("source") for item in selected["connections"]["sourceUses"]}
    selected["catalog"]["sources"] = copy.deepcopy([item for item in catalog["sources"] if item.get("id") in used])

    def sort_set(items, key):
        keys = [key(item) for item in items]
        if len(keys) != len(set(keys)):
            raise ReadingError("normalization.duplicate", "Duplicate declared set key")
        items.sort(key=key)

    sort_set(selected["catalog"]["sources"], lambda item: item["id"])
    if used != {item["id"] for item in selected["catalog"]["sources"]}:
        raise ReadingError("context.source", "A selected source use has no registered definition")
    for registration in selected["catalog"]["records"]:
        for key in ("owners", "tags"):
            if not isinstance(registration.get(key), list) or not all(isinstance(value, str) for value in registration[key]):
                raise ReadingError("normalization.shape", "Owner and tag sets contain strings")
            sort_set(registration[key], lambda value: value)
    ids = []
    for kind in kinds:
        items = selected["connections"][kind]
        ids.extend(item["id"] for item in items)
        sort_set(items, lambda item: item["record"] + "\0" + item["id"])
    if len(ids) != len(set(ids)):
        raise ReadingError("normalization.duplicate", "Connection IDs are unique within the owner ID")
    for item in selected["connections"]["coverage"]:
        if "exclude" in item:
            sort_set(item["exclude"], lambda value: value)
    for item in selected["connections"]["checkSelections"]:
        sort_set(item["subjects"], lambda value: value["kind"] + "\0" + value["selector"])
        sort_set(item["evidenceKinds"], lambda value: value)
    return selected


def canonical_json(value) -> bytes:
    """RFC 8785 serialization restricted to null/bool/string/safe-int trees."""
    def encode(item) -> str:
        if item is None:
            return "null"
        if type(item) is bool:
            return "true" if item else "false"
        if type(item) is int and abs(item) <= MAX_INTEGER:
            return str(item)
        if isinstance(item, str):
            return json.dumps(scalar_text(item), ensure_ascii=False)
        if isinstance(item, list):
            return "[" + ",".join(encode(child) for child in item) + "]"
        if isinstance(item, dict):
            # JCS compares property names as UTF-16 code units, unlike set keys.
            if any(not isinstance(key, str) for key in item):
                raise ReadingError("canonical.key", "JSON object keys must be strings")
            keys = sorted(item, key=lambda key: scalar_text(key).encode("utf-16-be"))
            return "{" + ",".join(encode(key) + ":" + encode(item[key]) for key in keys) + "}"
        raise ReadingError("canonical.domain", "Value is outside this reader's integer-only JSON domain", unsupported=True)

    return encode(value).encode("utf-8")


def read_document(data: bytes, limits: Limits = Limits(), *, context: dict | None = None) -> dict:
    if len(data) > limits.record_bytes:
        raise ReadingError("limit.record-bytes", "Whole-record byte limit exceeded")
    if data.startswith(b"\xef\xbb\xbf"):
        raise ReadingError("text.bom", "A leading UTF-8 BOM is forbidden")
    try:
        text = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ReadingError("text.utf8", f"Invalid UTF-8 at byte {error.start}") from error
    if "\x00" in text:
        raise ReadingError("text.nul", "NUL is forbidden in a Knowledge document")
    if text.startswith("---\r\n"):
        header_start = 5
    elif text.startswith("---\n"):
        header_start = 4
    else:
        raise ReadingError("framing.open", "First line must be exactly --- with LF or CRLF")
    cursor = header_start
    while True:
        ending = text.find("\n", cursor)
        if ending < 0:
            raise ReadingError("framing.close", "Closing delimiter requires its own LF or CRLF line")
        line = text[cursor:ending]
        if line in ("---", "---\r"):
            header_text = text[header_start:cursor]
            body = text[ending + 1:]
            break
        cursor = ending + 1
    if len(header_text.encode("utf-8")) > limits.front_matter_bytes:
        raise ReadingError("limit.front-matter-bytes", "Front-matter byte limit exceeded")
    if not body:
        raise ReadingError("framing.body", "Body must be nonempty")
    header = strict_json(header_text, limits)
    if header.get("schema") != "intent.knowledge-record.v2":
        raise ReadingError("format.unsupported", "Current reading requires intent.knowledge-record.v2")
    if set(header) != {"schema", "kind", "id", "status"}:
        raise ReadingError("header.fields", "Current headers contain only their four identity and state fields")
    selected = normalize_context(context, header["id"])
    semantic_bytes = canonical_json({"body": body.replace("\r\n", "\n"), "frontMatter": header, "context": selected})
    return {
        "profile": PROFILE,
        "schemaValidation": "not-performed",
        "commonMarkValidation": "not-performed",
        "semanticDigestStatus": "conditional-on-schema-validation",
        "header": header,
        "context": selected,
        "body": body,
        "sourceDigest": fingerprint(data),
        "semanticDigest": fingerprint(semantic_bytes),
        "limits": vars(limits),
    }


def read_path(path: Path, limits: Limits = Limits(), *, context: dict | None = None) -> dict:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    if path.is_symlink():
        raise ReadingError("source.symlink", "Selected input must not be a symbolic link")
    descriptor = os.open(path, flags)
    with os.fdopen(descriptor, "rb") as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ReadingError("source.regular-file", "Selected input must be a regular file")
        data = stream.read(limits.record_bytes + 1)
    return read_document(data, limits, context=context)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="One explicitly selected Knowledge Markdown file")
    parser.add_argument("--catalog", type=Path, required=True, help="Explicit catalog JSON file")
    parser.add_argument("--connections", type=Path, required=True, help="Explicit connections JSON file")
    args = parser.parse_args(argv)
    try:
        context = {}
        for name in ("catalog", "connections"):
            path = getattr(args, name)
            if path.is_symlink() or not path.is_file():
                raise ReadingError("source.regular-file", "Global inputs must be regular files")
            with path.open("rb") as stream:
                data = stream.read(Limits().record_bytes + 1)
            if len(data) > Limits().record_bytes:
                raise ReadingError("limit.global-bytes", "Global file exceeds the declared byte limit")
            if data.startswith(b"\xef\xbb\xbf"):
                raise ReadingError("text.bom", "Global input must not contain a BOM")
            try:
                text = data.decode("utf-8", errors="strict")
            except UnicodeDecodeError as error:
                raise ReadingError("text.utf8", "Global input must be valid UTF-8") from error
            if "\0" in text:
                raise ReadingError("text.nul", "Global input must not contain NUL")
            context[name] = strict_json(text, Limits())
        result = read_path(args.path, context=context)
    except (ReadingError, OSError) as error:
        unsupported = isinstance(error, ReadingError) and error.unsupported
        result = {"profile": PROFILE, "error": {
            "code": error.code if isinstance(error, ReadingError) else "source.io",
            "message": str(error), "unsupported": unsupported,
        }}
        print(json.dumps(result, ensure_ascii=False))
        return 2 if unsupported else 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
