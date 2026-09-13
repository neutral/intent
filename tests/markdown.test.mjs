import test from "node:test";
import assert from "node:assert/strict";
import { renderKnowledgeMarkdown } from "../dist/library/markdown.js";
test("rendered meaning follows CommonMark headings and keeps fenced examples as code",()=>{
  const html=renderKnowledgeMarkdown('# Title\n\n## Meaning\n\n**Important**\n\n```md\n## Example heading\n```\n',{omitTitle:true});
  assert.doesNotMatch(html,/<h1>/);assert.match(html,/<h2>Meaning<\/h2>/);assert.match(html,/<strong>Important<\/strong>/);assert.match(html,/<code class="language-md">## Example heading/);
});
test("rendering suppresses raw HTML, unsafe links and automatic image retrieval",()=>{
  const html=renderKnowledgeMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![Remote diagram](https://private.test/image)\n');
  assert.doesNotMatch(html,/<script>|javascript:|<img|private\.test/);assert.match(html,/Image: Remote diagram/);
});
