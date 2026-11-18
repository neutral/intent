---
{"id":"description:tests.queue-test-js"}
---
# Queue tests: taking due entries and surviving a kill

Each test fills a queue in memory storage and checks what taking and killing do to it.

## Relations

- applies description:src.scheduler.queue-js:take-marks-nothing, "takeDue marks nothing"
- applies assurance:reminder-app-accepted-never-lost:survives-kill, "survives a kill at each step"

## Read against

- tests/queue.test.js sha256:0000000000000000
- description:src.scheduler.queue-js:take-marks-nothing sha256:d4f4007b630afe2f
- assurance:reminder-app-accepted-never-lost:survives-kill sha256:3d44f83978c5355e
