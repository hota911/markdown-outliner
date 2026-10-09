window.BENCHMARK_DATA = {
  "lastUpdate": 1791525818848,
  "repoUrl": "https://github.com/hota911/markdown-outliner",
  "entries": {
    "Performance": [
      {
        "commit": {
          "author": {
            "email": "38419042+hota911@users.noreply.github.com",
            "name": "Hiroyuki Ota",
            "username": "hota911"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "e60dde8a2fc82cf7c7881dee0ade1fff931182d0",
          "message": "大きなファイルでの性能を CI で継続的に測る (#56)\n\n* Track performance on large files in CI\n\nAdd npm run test:perf, which times opening, typing, indenting, merging and\nfiltering on outlines of 17,000 and 34,000 items (about 2MB), each in its own\nprocess, and fails when twice the file takes three times as long or the\nlarger file takes over a second.\n\nThe Performance workflow compares a pull request with its base on the same\nrunner (scripts/perf-compare.mjs: warning at 1.3x, failure at 2x, Mann-Whitney\nU with Bonferroni correction) and records each commit to main in the gh-pages\nbranch with github-action-benchmark.\n\nParsing looked up rows with a linear search for every line, which made it\nquadratic: about 2s to open a 2MB file. Use a map by line.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* TEMPORARY: compare the head with itself to measure noise\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* TEMPORARY: slow down filtering and merging to check both lines\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* TEMPORARY: compare with the commit before the slowdown\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* Revert the temporary commits used to check the comparison on CI\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* Note the run-to-run spread measured on CI in the READMEs\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-09T14:33:25+09:00",
          "tree_id": "f21e32994e3b28738cd8d06b127e0d88a5ffdc91",
          "url": "https://github.com/hota911/markdown-outliner/commit/e60dde8a2fc82cf7c7881dee0ade1fff931182d0"
        },
        "date": 1791524026907,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 31.466259000000036,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 56.52797800000002,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 56.924022000000036,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 122.37126599999999,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 51.772699999999986,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 102.83206500000006,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 71.24241700000005,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 138.46750799999995,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.770577000000003,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.476476999999988,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 14.964276999999981,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 28.23372599999999,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 14.755457999999976,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 28.038928999999996,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 12.383580999999992,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.834325000000035,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "38419042+hota911@users.noreply.github.com",
            "name": "Hiroyuki Ota",
            "username": "hota911"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "146b852c336d61863072049f1eac3ffcbb439c39",
          "message": "PR ごとのプレビューを 1 つの HTML ファイルの artifact として配る (#50)\n\n* Add a static preview build of the web app for PR preview deployments\n\nbuild:preview writes dist/preview/, the web app on an in-memory adapter\nseeded with samples/ at build time, so it can be served by any static\nhost such as Cloudflare Pages. Reload resets to the samples.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* Deliver the PR preview as one HTML file in a workflow artifact\n\nReplace the Cloudflare Pages setup: build:preview now inlines the script\nand the styles into dist/preview/markdown-outliner-preview.html, and the\nPreview workflow uploads it unzipped and links it in a PR comment.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-09T15:03:18+09:00",
          "tree_id": "ef6eb2c404f1713d6c2ced4c9ab7a004e24fbf82",
          "url": "https://github.com/hota911/markdown-outliner/commit/146b852c336d61863072049f1eac3ffcbb439c39"
        },
        "date": 1791525818831,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 24.77074700000003,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 42.38946400000003,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 45.180560000000014,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 88.16891599999997,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 35.96181200000001,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 67.64229099999994,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 54.05586900000003,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 114.62385500000005,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 3.9584350000000086,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 7.976153000000011,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 10.63157099999998,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 22.601677999999993,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 10.865234999999984,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 21.440866000000028,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 9.942372999999975,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 18.69829299999998,
            "unit": "ms"
          }
        ]
      }
    ]
  }
}