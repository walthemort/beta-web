# Public rendering pass

The performance pass accompanies the new project index/stage and removal of the rejected blue gesture. Removed work includes scroll-linked text-gradient painting, text-node splitting, pointer-driven image pans and magnetic actions, SVG clip/draw animation, backdrop blur over the moving client strip, whole-page view-transition snapshots and modal project clipping/height animations. Service studies now crossfade without zoom or masks. The fullscreen menu slides using transform and closes in 180 ms.

## Local sample

Chromium, 1440×1000, 4× CPU throttling, fonts loaded, 1.5 seconds to settle, then 180 animation-frame scroll steps over the complete homepage. The earlier design and rebuilt homepage have different content/layout lengths; this measures their actual full-page rendering work under the same sampling procedure. Samples were run without other browser test suites. The earlier revision was `4d10bc0`.

| Timeline measure | Earlier design | Rebuilt design |
| --- | ---: | ---: |
| Paint events | 694 | 214 |
| Paint time | 255.6 ms | 83.3 ms |
| Style update time | 163.6 ms | 96.7 ms |
| Layout events | 19 | 12 |
| Layout time | 18.1 ms | 11.2 ms |
| 95th percentile frame interval | 17.7 ms | 17.8 ms |
| Frame intervals over 32 ms | 2 | 0 |

Paint time falls by about 67% in this local sample. Frame cadence remains close to the display interval; this is not a universal FPS improvement claim and does not reproduce the user’s GPU or establish the cause of every reported stall.

Run `npm run profile:scroll` for the same procedure. It prints a JSON summary and saves `beta-scroll-profile.json` in the system temporary directory. An optional path can be passed after `--`. Each run uses its own ephemeral test server and closes its browser/server. The command is a diagnostic, not a hardware-dependent pass/fail test.

`test:studio` checks that removed effects stay absent, menu motion uses transform, and scroll lock/focus are restored. `test:projects` checks steady image dimensions, cancellation of stale decoded selections and filters, native case links, saved panel state, keyboard/mobile/no-JS behavior and empty states. Service and review/planner flows retain their own browser checks.
