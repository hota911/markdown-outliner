//! Debug builds only (`npm run tauri:dev`, or `cargo tauri build --debug`): hooks to check the app
//! without UI automation or screen recording permissions, which this project's checks cannot rely on.
//!
//! - `OUTLINER_DEBUG_SCRIPT=<file>` evaluates that file in the page after each load. The script can
//!   call `window.__TAURI_INTERNALS__.invoke` with `debug_log` ({ text }) to print to stdout,
//!   `debug_window` to print the window title and the menus, and `debug_snapshot` ({ path }) to
//!   write a PNG of the page.
//! - `OUTLINER_DEBUG_THEME=light|dark` overrides the system appearance.

use tauri::ipc::CapabilityBuilder;
use tauri::menu::MenuItemKind;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, Runtime, Theme, WebviewWindow, WebviewWindowBuilder};

/// Grants the debug commands, which the capability files leave out so release builds never have them.
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    app.add_capability(
        CapabilityBuilder::new("debug")
            .window("main")
            .permission("allow-debug-log")
            .permission("allow-debug-window")
            .permission("allow-debug-snapshot"),
    )
}

pub fn configure<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    let builder = match std::env::var("OUTLINER_DEBUG_THEME").as_deref() {
        Ok("dark") => builder.theme(Some(Theme::Dark)),
        Ok("light") => builder.theme(Some(Theme::Light)),
        _ => builder,
    };
    builder.on_page_load(|window, payload| {
        let Ok(path) = std::env::var("OUTLINER_DEBUG_SCRIPT") else {
            return;
        };
        if payload.event() == PageLoadEvent::Finished {
            let script = std::fs::read_to_string(&path).expect("OUTLINER_DEBUG_SCRIPT is readable");
            window.eval(&script).expect("the debug script is evaluated");
        }
    })
}

#[tauri::command]
pub fn debug_log(text: String) {
    println!("{text}");
}

#[tauri::command]
pub fn debug_window(window: WebviewWindow) -> tauri::Result<()> {
    println!("window title: {}", window.title()?);
    let menu = window.app_handle().menu().expect("the app has a menu");
    for item in menu.items()? {
        if let MenuItemKind::Submenu(submenu) = item {
            let items: Vec<String> = submenu
                .items()?
                .iter()
                .map(|item| match item {
                    MenuItemKind::MenuItem(item) => item.text().unwrap_or_default(),
                    MenuItemKind::Predefined(item) => item.text().unwrap_or_default(),
                    _ => "?".into(),
                })
                .collect();
            println!("menu {}: {}", submenu.text()?, items.join(" | "));
        }
    }
    Ok(())
}

/// Writes a PNG of the page with WKWebView's snapshot, which needs no screen recording permission.
#[tauri::command]
pub fn debug_snapshot(webview: tauri::Webview, path: String) -> tauri::Result<()> {
    use block2::RcBlock;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
    use objc2_foundation::{NSDictionary, NSError};
    use objc2_web_kit::WKWebView;

    webview.with_webview(move |platform| {
        let path = path.clone();
        let done = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
            // SAFETY: WebKit passes either a valid image or a valid error.
            let Some(image) = (unsafe { image.as_ref() }) else {
                println!("snapshot failed: {:?}", unsafe { error.as_ref() });
                return;
            };
            let tiff = image
                .TIFFRepresentation()
                .expect("the snapshot has a TIFF representation");
            let bitmap = NSBitmapImageRep::imageRepWithData(&tiff).expect("the TIFF is a bitmap");
            // SAFETY: an empty dictionary is a valid property list.
            let png = unsafe {
                bitmap.representationUsingType_properties(
                    NSBitmapImageFileType::PNG,
                    &NSDictionary::new(),
                )
            }
            .expect("the bitmap encodes as PNG");
            std::fs::write(&path, png.to_vec()).expect("the snapshot is written");
            println!("snapshot {path}");
        });
        // SAFETY: `inner` is the WKWebView of this webview, used here on the main thread.
        unsafe {
            let view = &*platform.inner().cast::<WKWebView>();
            view.takeSnapshotWithConfiguration_completionHandler(None, &done);
        }
    })
}
