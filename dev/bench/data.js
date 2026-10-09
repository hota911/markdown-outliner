window.BENCHMARK_DATA = {
  "lastUpdate": 1791576978388,
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
      }
    ]
  }
}