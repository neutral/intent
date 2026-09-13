import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from reader import Limits, ReadingError, canonical_json, normalize_context, read_document, read_path, strict_json


def header(kind="blueprint"):
    return {"schema": "intent.knowledge-record.v2", "kind": kind,
            "id": kind + ".reader", "status": "draft"}


def context(value=None):
    value = value or header()
    return {"catalog": {"schema": "intent.catalog.v1", "sources": [], "records": [
        {"record": value["id"], "owners": ["z", "a"], "tags": []}]},
        "connections": {"schema": "intent.connections.v1", "relationships": [], "conflicts": [],
                        "sourceUses": [], "coverage": [], "checkSelections": []}}


def document(value=None, body="# Reader\n", newline="\n"):
    text = "---\n" + json.dumps(value or header(), ensure_ascii=False) + "\n---\n" + body
    return text.replace("\n", newline).encode("utf-8")


def read(data=None, value=None, **options):
    return read_document(data or document(), context=value or context(), **options)


class ReaderTests(unittest.TestCase):
    def assert_error(self, code, action):
        with self.assertRaises(ReadingError) as caught:
            action()
        self.assertEqual(caught.exception.code, code)
        return caught.exception

    def test_known_canonical_payload(self):
        source = document()
        result = read(source)
        selected = context()
        selected["catalog"]["records"][0]["owners"] = ["a", "z"]
        expected = canonical_json({"body": "# Reader\n", "frontMatter": header(), "context": selected})
        self.assertEqual(result["sourceDigest"], "sha256:" + hashlib.sha256(source).hexdigest())
        self.assertEqual(result["semanticDigest"], "sha256:" + hashlib.sha256(expected).hexdigest())
        self.assertEqual(result["semanticDigestStatus"], "conditional-on-schema-validation")
        self.assertNotIn("valid", result)

    def test_six_kind_profile_is_explicitly_narrow(self):
        for kind in ("behavior", "assurance", "blueprint", "description", "check", "discipline"):
            value = header(kind)
            result = read(document(value), context(value))
            self.assertEqual(result["header"]["kind"], kind)
            self.assertEqual(result["schemaValidation"], "not-performed")
            self.assertEqual(result["commonMarkValidation"], "not-performed")

    def test_current_format_and_context_are_required(self):
        old = header(); old["schema"] = "intent.knowledge-record.v1"
        self.assert_error("format.unsupported", lambda: read(document(old)))
        self.assert_error("context.required", lambda: read_document(document()))
        authored = header(); authored["owners"] = ["a"]
        self.assert_error("header.fields", lambda: read(document(authored)))

    def test_line_endings_and_preserved_markdown(self):
        body = "# Reader\n\nAn opening **summary**.\n\n## Connection: reference\n\n### Rationale\n\n    const value = 1;  \n\n> A quotation.\n"
        lf, crlf = read(document(body=body)), read(document(body=body, newline="\r\n"))
        self.assertEqual(lf["semanticDigest"], crlf["semanticDigest"])
        self.assertNotEqual(lf["sourceDigest"], crlf["sourceDigest"])
        self.assertEqual(crlf["body"], body.replace("\n", "\r\n"))
        self.assertNotEqual(lf["semanticDigest"], read(document(body=body.rstrip("\n")))["semanticDigest"])
        for derived in ("title", "summary", "sections", "relationshipDetails", "spec"):
            self.assertNotIn(derived, lf)

    def test_global_changes_change_only_affected_semantic_identity(self):
        value = context(); baseline = read(value=value)
        changed = copy.deepcopy(value); changed["catalog"]["records"][0]["tags"] = ["changed"]
        updated = read(value=changed)
        self.assertEqual(updated["sourceDigest"], baseline["sourceDigest"])
        self.assertNotEqual(updated["semanticDigest"], baseline["semanticDigest"])
        changed = copy.deepcopy(value); changed["catalog"]["records"].append({"record": "blueprint.other", "owners": ["a"], "tags": ["other"]})
        self.assertEqual(read(value=changed)["semanticDigest"], baseline["semanticDigest"])

    def test_revision_fields_and_coordinate_owners_are_rejected(self):
        old = header(); old["revision"] = 1; old["supersedes"] = None
        self.assert_error("header.fields", lambda: read(document(old)))
        value = context(); value["catalog"]["records"][0]["record"] = {"id": "blueprint.reader", "revision": 1}
        self.assert_error("context.registration", lambda: read(value=value))

    def test_source_selection_binds_definitions(self):
        value = context(); coordinate = "blueprint.reader"
        value["catalog"]["sources"] = [{"id": "manual", "reference": "first.md"}, {"id": "unused", "reference": "outside.md"}]
        value["connections"]["sourceUses"] = [{"id": "manual-use", "record": coordinate, "source": "manual", "required": False, "revision": None, "role": "research"}]
        baseline = read(value=value)
        self.assertEqual(len(baseline["context"]["catalog"]["sources"]), 1)
        value["catalog"]["sources"][0]["reference"] = "second.md"
        self.assertNotEqual(read(value=value)["semanticDigest"], baseline["semanticDigest"])
        value["catalog"]["sources"] = []
        self.assert_error("context.source", lambda: read(value=value))

    def test_normalized_sets_preserve_extension_sequences(self):
        value = context(); registration = value["catalog"]["records"][0]
        registration["tags"] = ["\U00010000", "\ue000"]
        registration["x-keys"] = {"\ue000": 1, "\U00010000": 2}
        registration["x-sequence"] = ["z", "a"]
        result = read(value=value)
        normalized = result["context"]["catalog"]["records"][0]
        self.assertEqual(normalized["tags"], ["\ue000", "\U00010000"])
        self.assertEqual(normalized["x-sequence"], ["z", "a"])
        self.assertEqual(canonical_json(normalized["x-keys"]), '{"𐀀":2,"":1}'.encode())
        permuted = copy.deepcopy(value); permuted["catalog"]["records"][0]["owners"].reverse()
        self.assertEqual(read(value=permuted)["semanticDigest"], result["semanticDigest"])
        permuted["catalog"]["records"][0]["x-sequence"].reverse()
        self.assertNotEqual(read(value=permuted)["semanticDigest"], result["semanticDigest"])

    def test_coverage_and_check_sets(self):
        for kind in ("description", "check"):
            h = header(kind); value = context(h); coordinate = h["id"]
            if kind == "description":
                value["connections"]["coverage"] = [{"id": "scope", "record": coordinate, "path": "src", "mode": "tree", "role": "primary", "exclude": ["src/z", "src/a"]}]
                selected = read(document(h), value)["context"]["connections"]["coverage"][0]
                self.assertEqual(selected["exclude"], ["src/a", "src/z"])
            else:
                value["connections"]["checkSelections"] = [{"id": "selection", "record": coordinate, "subjects": [{"kind": "file", "selector": "z"}, {"kind": "file", "selector": "a"}], "evidenceKinds": ["review", "command"]}]
                selected = read(document(h), value)["context"]["connections"]["checkSelections"][0]
                self.assertEqual(selected["subjects"][0]["selector"], "a")
                self.assertEqual(selected["evidenceKinds"], ["command", "review"])

    def test_duplicates_and_missing_registration(self):
        value = context(); value["catalog"]["records"][0]["owners"] = ["a", "a"]
        self.assert_error("normalization.duplicate", lambda: read(value=value))
        value = context(); value["catalog"]["records"] *= 2
        self.assert_error("context.registration", lambda: read(value=value))
        value = context(); value["catalog"]["records"] = []
        self.assert_error("context.registration", lambda: read(value=value))

    def test_encoding_and_framing(self):
        for code, data in [("text.bom", b"\xef\xbb\xbf"+document()), ("text.utf8", document()+b"\xc3\x28"), ("text.nul", document()+b"\0"), ("framing.open", b" \n"+document()), ("framing.close", b"---\n{}\n---"), ("framing.body", b"---\n{}\n---\n")]:
            self.assert_error(code, lambda: read(data))

    def test_strict_json_and_unsupported_numeric_domain(self):
        for code, text in [("json.duplicate-key", '{"a":1,"\\u0061":2}'), ("json.unicode", '{"x":"\\ud800"}'), ("json.nonfinite", '{"x":NaN}'), ("json.integer", '{"x":9007199254740992}'), ("json.syntax", '{"x":1,}'), ("json.syntax", '{} {}'), ("json.header-object", '[]')]:
            self.assert_error(code, lambda: strict_json(text, Limits()))
        for token in ("1.0", "1e0", "-0.0", "1e999"):
            error = self.assert_error("profile.float-unsupported", lambda: strict_json('{"x":'+token+'}', Limits()))
            self.assertTrue(error.unsupported)
        self.assertEqual(strict_json('{"x":-0}', Limits())["x"], 0)
        self.assertEqual(strict_json('{"x":"\\ud83d\\ude00"}', Limits())["x"], "😀")
        for number in (-(2**53-1), 2**53-1):
            self.assertEqual(strict_json('{"x":'+str(number)+'}', Limits())["x"], number)

    def test_json_bounds_and_exact_escaping(self):
        text = '{"a":1,"b":[true]}'
        self.assertEqual(strict_json(text, Limits(json_depth=3, json_nodes=4))["a"], 1)
        self.assert_error("limit.json-nodes", lambda: strict_json(text, Limits(json_nodes=3)))
        self.assert_error("limit.json-depth", lambda: strict_json(text, Limits(json_depth=2)))
        source = document()
        self.assert_error("limit.record-bytes", lambda: read(source, limits=Limits(record_bytes=len(source)-1)))
        self.assert_error("limit.front-matter-bytes", lambda: read(source, limits=Limits(front_matter_bytes=1)))
        self.assertEqual(canonical_json({"text": "\b\t\n\f\r\x00\x1f\"\\/é\u2028"}), '{"text":"\\b\\t\\n\\f\\r\\u0000\\u001f\\"\\\\/é\u2028"}'.encode())

    def test_selected_file_and_cli_require_exact_global_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); path = root/"sample.md"; path.write_bytes(document())
            self.assertEqual(read_path(path, context=context())["body"], "# Reader\n")
            link = root/"link.md"; link.symlink_to(path)
            self.assert_error("source.symlink", lambda: read_path(link, context=context()))
            for key, value in context().items():
                (root/(key+".json")).write_text(json.dumps(value))
            program = Path(__file__).with_name("reader.py")
            arguments = [sys.executable, str(program), str(path), "--catalog", str(root/"catalog.json"), "--connections", str(root/"connections.json")]
            for source, expected in [(document(), 0), (b"invalid", 1), (b'---\n{"n":1.0}\n---\nbody', 2)]:
                path.write_bytes(source); run = subprocess.run(arguments, capture_output=True, text=True)
                self.assertEqual(run.returncode, expected, run.stderr)
                self.assertEqual("error" in json.loads(run.stdout), expected != 0)


if __name__ == "__main__":
    unittest.main()
