# Corrected portrait WebGL failure

Actual selected attempt run2-ipad-webgl-stills, exit 1/1813.28 s. Playwright reported Test timeout of 1800000 ms exceeded; page/context-closed followed during fourth-party-turn settling. This remains a failed partial route; no further retry. The video-only correction did not establish completion.

# Test info

- Name: forest-road-polish.review.ts >> Forest Road native audit from Ba Dan to quarry gate
- Location: e2e/forest-road-polish.review.ts:27:1

# Error details

```
Test timeout of 1800000ms exceeded.
```

Fixture failure record:

```text
page.evaluate: Target page, context or browser has been closed
    at settleLayout (/workspace/avatarrpg-379/e2e/helpers.ts:258:22)
    at takeTurn (/workspace/avatarrpg-379/e2e/helpers.ts:166:45)
    at /workspace/avatarrpg-379/e2e/forest-road-polish.review.ts:279:13
```
