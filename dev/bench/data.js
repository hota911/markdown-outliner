window.BENCHMARK_DATA = {
  "lastUpdate": 1791959549630,
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
          "id": "87611dc88f0127a4c452c817e25ac60712082c49",
          "message": "Pin the header to the top edge of the Obsidian tab without a gap (#58)\n\nThe Obsidian view's container is the scroll container and had 16px of top\npadding. A sticky element sticks at the edge of the scroll container's content\nbox, so the pinned header stopped 16px below the top and rows showed through\nthe gap. Move that padding to the workspace inside the container.\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-09T15:03:24+09:00",
          "tree_id": "2ea020b87250ced815789ddb5dc80dcc7cda9f8e",
          "url": "https://github.com/hota911/markdown-outliner/commit/87611dc88f0127a4c452c817e25ac60712082c49"
        },
        "date": 1791525840737,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 31.706975999999997,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 56.640566000000035,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 57.203216,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 110.54436799999996,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 48.727940000000046,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 78.65565300000003,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 69.72608000000002,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 143.0787969999999,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.722616000000016,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.362802000000045,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 14.444507000000044,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 27.624458000000004,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 13.956387000000007,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 26.739599,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 10.99593299999998,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.421954000000028,
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
          "id": "b6f1ca1c2d2a89f083c2a955236d341bd264d09e",
          "message": "Wrap long bookmark names and scroll the bookmarks apart from the outline (#54)\n\nObsidian's stylesheet gives every button a fixed height and a centered\ninline-flex layout. The bookmark name button did not override them, so a\nlong name wrapped but spilled over the next bookmark. The bookmark buttons\nnow set display and height themselves.\n\nThe bookmarks sidebar is sticky with its own vertical scroll: max-height\n100dvh in the web version and 100cqh of Obsidian's view container (now a\nsize container). At 600px or narrower it stays above the outline, capped\nat 40% of the view height, and scrolls inside.\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-09T15:12:35+09:00",
          "tree_id": "f1ed38581ba9b46929af35994125753f6144dacd",
          "url": "https://github.com/hota911/markdown-outliner/commit/b6f1ca1c2d2a89f083c2a955236d341bd264d09e"
        },
        "date": 1791526377286,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 34.91062899999997,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 56.40908999999999,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 57.85302999999999,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 106.23524699999996,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 44.08315299999998,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 93.54754100000002,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 75.80639500000001,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 154.62482899999986,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.8240260000000035,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.473906999999997,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 14.628010999999958,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 28.49132099999997,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 13.694504999999992,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 27.25989900000002,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 16.387845000000027,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.630708000000027,
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
          "id": "0dceded6c55d3ca81b86dde818c4047eff28c4ae",
          "message": "見出しを読み取り専用の行として表示し、見出しをまたいで項目を移動できるようにする (#53)\n\n* Show headings as read-only rows and move items across them\n\nHeadings (# to ######) become rows in the outline, with the unindented\nitems of their section and deeper headings as children. Items move into\nanother section with Alt+Up/Down, drag and drop, and the move buttons;\nheadings fold and zoom but cannot be renamed, added, deleted or moved.\nOnly the moved lines change, paragraphs keep their place, and moves that\nwould make other text part of an item are refused.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* Rename the headings sample so tasks.md stays the first sample file\n\nThe outliner opens the first Markdown file by name when no file was shown\nbefore. samples/sections.md sorted before tasks.md, so the Obsidian tests,\nthe preview, and `npm run dev` / `npm run demo` opened the headings sample\ninstead of tasks.md, and 6 Obsidian e2e tests that read tasks.md failed.\nAs weekly.md it sorts after tasks.md. The preview test lists the new file.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-10T05:01:09+09:00",
          "tree_id": "83bd36e5f3e8edf142b95c90a8e15ae3ebe0b91d",
          "url": "https://github.com/hota911/markdown-outliner/commit/0dceded6c55d3ca81b86dde818c4047eff28c4ae"
        },
        "date": 1791576092844,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 37.049567000000025,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 57.673854000000006,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 56.88534500000003,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 120.22609299999999,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 48.63672399999996,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 105.06612199999995,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 74.97888799999998,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 144.10364499999991,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.710244000000046,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.625118999999984,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 14.703930000000014,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 28.032445999999993,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 14.776616999999987,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 27.12173899999999,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 10.698244000000045,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.416417000000024,
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
          "id": "118db131f6e22c1582b9e5aa430bf54319757aef",
          "message": "Add Collapse and Expand to the / command menu (#55)\n\nCollapse is offered for an expanded item with children and Expand for a\ncollapsed one; neither for an item without children or the zoomed-in\nitem. They use the same fold state (row keys) as the fold button, remove\nthe typed /query text in one undo step like the other commands, and keep\nthe focus in the item's title.\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-10T05:09:16+09:00",
          "tree_id": "fb92646d1bbebdf58db88fe68639cef76a47ee92",
          "url": "https://github.com/hota911/markdown-outliner/commit/118db131f6e22c1582b9e5aa430bf54319757aef"
        },
        "date": 1791576580214,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 41.66166899999996,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 59.828430999999966,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 62.26544100000001,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 125.99554599999999,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 51.15761100000003,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 94.38826900000004,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 70.97952299999997,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 143.71242299999994,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.742993000000013,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.325681999999972,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 14.115088000000014,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 28.442158000000006,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 13.463889999999992,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 27.119715999999983,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 10.740141000000023,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.65457399999997,
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
          "id": "224ff9bdaaf6345aefdc8d3d2b0ccfd91bb5bb90",
          "message": "Obsidian の E2E テストを画面にウィンドウを出さずに実行する (#57)\n\n* Run the Obsidian e2e tests without showing a window\n\nOn macOS, start Obsidian in the background with open -g and make its window\ntransparent and click-through before it first shows; OBSIDIAN_E2E_HEADED=1\nkeeps the old foreground window. Add a non-required workflow that runs the\ntests on Linux under Xvfb with a pinned, checksum-verified Obsidian build.\nOBSIDIAN_EXECUTABLE replaces OBSIDIAN_APP.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* Close the Obsidian settings only if they open, and keep the hidden window unfocusable\n\nObsidian 1.14 on Linux does not open the community plugin settings after\ntrusting the vault, which hung the CI setup. On macOS, text typed with an\ninput method in another app reached the transparent test window, so it is\nmade unfocusable. Document local runs in AGENTS.md and the READMEs.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* DEBUG: dump the pane menu on Linux (to be reverted)\n\n* DEBUG: trace the pane menu on Linux (to be reverted)\n\n* DEBUG: list menu elements on Linux (to be reverted)\n\n* DEBUG: probe activeWindow on Linux (to be reverted)\n\n* DEBUG: find where the extra window appears (to be reverted)\n\n* Close the settings window that Obsidian 1.14 opens after trusting the vault\n\nObsidian 1.14 opens the community plugin settings in a separate window,\nnot as a modal, and then opens menus in that window. The fixture closes\neither, waits until menus open in the main window again, and hides any\nwindow Obsidian creates in hidden mode. Removes the temporary debug output.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* Keep the test Obsidian from becoming the active app on macOS\n\nEven when started with open -g, Obsidian activated itself about 0.5 s after\nevery launch, so keys the user was typing in another app went to it for a\nmoment. Making it a background-only app with the 'prohibited' activation\npolicy prevents that.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-10T05:09:23+09:00",
          "tree_id": "c1e0fcb5619663d295096c648730d8883277b10a",
          "url": "https://github.com/hota911/markdown-outliner/commit/224ff9bdaaf6345aefdc8d3d2b0ccfd91bb5bb90"
        },
        "date": 1791576602531,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 39.05575699999997,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 63.29507100000001,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 56.11465600000008,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 113.22606899999994,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 47.22754000000009,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 87.49130300000002,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 71.66472799999997,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 144.22864800000002,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.909165999999971,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.531503999999984,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 14.888216999999997,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 27.824385000000007,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 13.746192999999977,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 26.86717600000003,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 10.725864000000001,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 22.917202999999972,
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
          "id": "2695f5c4656b8a5fe1f5e9ac7166d3129dd81c9e",
          "message": "Release 0.1.4 (#59)\n\n* Release 0.1.4\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n* Track the glib update that waits for Tauri's GTK4 move\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-10T05:15:55+09:00",
          "tree_id": "bcba40fa51bf4aba4aa3522d82b1df07606a1d6b",
          "url": "https://github.com/hota911/markdown-outliner/commit/2695f5c4656b8a5fe1f5e9ac7166d3129dd81c9e"
        },
        "date": 1791576978362,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 40.73898600000001,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 63.906881,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 55.52131499999996,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 127.92441800000006,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 53.14419400000003,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 85.91034800000011,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 81.77288499999997,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 147.279679,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.8062400000000025,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.125563,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 16.24960599999997,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 29.988568999999984,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 13.807461999999987,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 28.194882999999948,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 12.097864000000015,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.96171499999997,
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
          "id": "7be064edee9fba3ded6d8c8be1e550d8f3440b6c",
          "message": "Reorder bookmarks by drag and drop or Alt+Up/Down (#60)\n\nEach bookmark gets a ⠿ handle. Dragging it with the mouse or by touch shows\nan insertion line between bookmarks and moves the bookmark there; Alt+Up/Down\non a focused bookmark or its handle moves it by one and keeps the focus on it.\nThe order is part of the saved preferences, so it persists in local storage\non the web and in the plugin data in Obsidian with no format change.\n\nDragging uses pointer events with pointer capture instead of HTML5 drag and\ndrop, which does not work reliably with touch (the outline items do not\nsupport touch dragging for that reason).\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-14T12:29:06+09:00",
          "tree_id": "4de31a35ae17d0836265b4d2d69a5526a356a461",
          "url": "https://github.com/hota911/markdown-outliner/commit/7be064edee9fba3ded6d8c8be1e550d8f3440b6c"
        },
        "date": 1791948570729,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 37.454139999999995,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 59.49333999999999,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 60.41482000000008,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 112.32221400000003,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 46.207516999999996,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 87.58016099999998,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 71.210555,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 140.29458099999988,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.674343000000022,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 9.951526999999999,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 15.617549999999994,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 28.67060799999996,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 13.518701999999962,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 26.915705000000003,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 11.006036000000023,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.434597000000053,
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
          "id": "c99a538a6bbcf5de3f4c0d697ec3cf607e525de8",
          "message": "Delete an embedded file from its embed header (#61)\n\nThe embed header gets a Delete action next to Rename. It asks in place,\nnaming the file, with Cancel focused; on confirmation the file moves to\nthe trash and the embed line is removed.\n\n- Web: POST /api/trash moves the file into .trash/ at the served root,\n  creating it when missing and adding a number on name collisions. It\n  never unlinks a file without a hard link in the trash, refuses symlinks,\n  a .trash that is not a folder, and single-file mode.\n- Obsidian: FileManager#trashFile, which follows the \"Deleted files\"\n  setting (Vault#trash is banned by the obsidianmd lint rules).\n- Refused with a toast, changing nothing, when the file is embedded\n  elsewhere in the loaded docs, the embed has children or a note, the\n  file is missing, or a save or conflict is pending.\n- Undo restores only the embed line; README.md and README.ja.md say so.\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-14T12:37:26+09:00",
          "tree_id": "afbf8c28b850b16b64f950d823c76ba84a649f7a",
          "url": "https://github.com/hota911/markdown-outliner/commit/c99a538a6bbcf5de3f4c0d697ec3cf607e525de8"
        },
        "date": 1791949070401,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 38.60930900000005,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 54.83244500000001,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 58.46622000000002,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 117.541199,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 45.66547400000002,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 85.61531300000001,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 68.50230600000009,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 146.61465700000008,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.83272199999999,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 11.020999999999958,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 15.500382000000002,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 29.462274999999977,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 15.246757000000002,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 31.22674200000006,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 11.417106999999987,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.882588999999996,
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
          "id": "66f81f8d7915641b4b6fb5c09c948ef15966fc5b",
          "message": "Release 0.1.5 (#67)\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-14T14:27:37+09:00",
          "tree_id": "1c71d63c5bcee62ff1f4240297f03c0ab69631bb",
          "url": "https://github.com/hota911/markdown-outliner/commit/66f81f8d7915641b4b6fb5c09c948ef15966fc5b"
        },
        "date": 1791955684766,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 33.86273500000004,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 62.82162199999999,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 63.19170500000007,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 111.02842600000008,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 47.440822999999966,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 88.18652600000001,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 74.59500100000002,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 145.81754899999987,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.805087999999955,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.08024499999999,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 14.533365000000003,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 28.475776999999994,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 14.639855000000011,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 27.948915,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 11.120065000000011,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 21.86126900000005,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "158243242+devin-ai-integration[bot]@users.noreply.github.com",
            "name": "devin-ai-integration[bot]",
            "username": "devin-ai-integration[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ed02aac459a2792c64564485762ff38a6396bc22",
          "message": "Show Tasks and pomodoro fields as badges, with pomodoro sums (#63)\n\nCo-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>\nCo-authored-by: Hiroyuki Ota <hiroyuki.ot@gmail.com>",
          "timestamp": "2026-10-14T06:24:10Z",
          "tree_id": "fc23f51340e28c2dfbeac54b366ac7d30e7f0f6f",
          "url": "https://github.com/hota911/markdown-outliner/commit/ed02aac459a2792c64564485762ff38a6396bc22"
        },
        "date": 1791959073249,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 39.24132099999997,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 64.50521200000003,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 56.890398000000005,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 118.45415400000002,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 48.60554400000001,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 95.89177399999994,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 73.15479600000003,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 146.24835699999994,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 5.775954000000013,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 10.168005999999991,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 14.365656000000001,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 28.567655999999943,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 14.224261999999953,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 28.553199000000063,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 12.680001000000004,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 23.448478000000023,
            "unit": "ms"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "158243242+devin-ai-integration[bot]@users.noreply.github.com",
            "name": "devin-ai-integration[bot]",
            "username": "devin-ai-integration[bot]"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "50c8f19fe8038f4103ae0a27a62583a8c35bd5b4",
          "message": "Start a pomodoro on a task row with the Pomodoro Timer plugin (experimental) (#64)\n\nCo-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>\nCo-authored-by: Hiroyuki Ota <hiroyuki.ot@gmail.com>",
          "timestamp": "2026-10-14T06:32:06Z",
          "tree_id": "2379da007af04b9a3a13a86f8635084dcfad1e52",
          "url": "https://github.com/hota911/markdown-outliner/commit/50c8f19fe8038f4103ae0a27a62583a8c35bd5b4"
        },
        "date": 1791959549614,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "open: parse the file and key its rows (17000 items)",
            "value": 33.62524500000001,
            "unit": "ms"
          },
          {
            "name": "open: parse the file and key its rows (34000 items)",
            "value": 55.36553500000002,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (17000 items)",
            "value": 56.55566500000003,
            "unit": "ms"
          },
          {
            "name": "type: change a title, as every keystroke does (34000 items)",
            "value": 116.29028499999993,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (17000 items)",
            "value": 44.459925,
            "unit": "ms"
          },
          {
            "name": "indent and move an item (34000 items)",
            "value": 80.01676499999996,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (17000 items)",
            "value": 69.330916,
            "unit": "ms"
          },
          {
            "name": "merge an external change into unsaved input (34000 items)",
            "value": 139.538413,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (17000 items)",
            "value": 4.735502999999994,
            "unit": "ms"
          },
          {
            "name": "resolve a conflict (34000 items)",
            "value": 9.743469000000005,
            "unit": "ms"
          },
          {
            "name": "filter by words (17000 items)",
            "value": 13.531971999999996,
            "unit": "ms"
          },
          {
            "name": "filter by words (34000 items)",
            "value": 26.93665299999998,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (17000 items)",
            "value": 12.790232000000003,
            "unit": "ms"
          },
          {
            "name": "filter by a tag (34000 items)",
            "value": 25.463187000000005,
            "unit": "ms"
          },
          {
            "name": "filter by a status (17000 items)",
            "value": 11.240606000000014,
            "unit": "ms"
          },
          {
            "name": "filter by a status (34000 items)",
            "value": 22.119518000000028,
            "unit": "ms"
          }
        ]
      }
    ]
  }
}