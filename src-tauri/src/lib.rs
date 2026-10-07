//! The desktop app: one window that runs the shared UI (src/tauri/main.ts) and answers its file
//! commands from the folder the user picked (workspace.rs).

#[cfg(debug_assertions)]
mod debug;
mod workspace;

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

use workspace::{revision_of, Code, Workspace};

const WINDOW: &str = "main";
const OPEN_FOLDER: &str = "open-folder";
/// Opens this folder for one launch without remembering it, like the folder argument of server.mjs.
const WORKSPACE_VARIABLE: &str = "OUTLINER_WORKSPACE";

struct AppState {
    workspace: Mutex<Option<Workspace>>,
    // The app's config folder: `last-folder` holds the last chosen folder as a plain path (the app
    // is not sandboxed, so it needs no security-scoped bookmark) and `preferences/` the bookmarks
    // of each folder, as the JSON the web version keeps in local storage.
    config_dir: PathBuf,
}

impl AppState {
    fn with_workspace<T>(
        &self,
        run: impl FnOnce(&Workspace) -> workspace::Result<T>,
    ) -> Result<T, Code> {
        let workspace = self.workspace.lock().expect("workspace lock poisoned");
        let workspace = workspace.as_ref().ok_or_else(|| {
            eprintln!("Markdown Outliner: a command arrived before a folder was opened");
            Code::Internal
        })?;
        run(workspace).map_err(|error| match error {
            workspace::Error::Rejected(code) => code,
            workspace::Error::Io(error) => {
                eprintln!("Markdown Outliner: {error}");
                Code::Internal
            }
        })
    }

    fn preferences_file(&self, workspace: &Workspace) -> PathBuf {
        let key = revision_of(&workspace.root().to_string_lossy());
        self.config_dir.join("preferences").join(key + ".json")
    }
}

#[derive(Serialize)]
struct ReadReply {
    text: String,
    revision: String,
}

#[derive(Serialize)]
struct SaveReply {
    revision: String,
}

// `async` runs the commands off the main thread, so file access does not block the window.

#[tauri::command(async)]
fn list(state: State<AppState>) -> Result<Vec<String>, Code> {
    state.with_workspace(Workspace::list)
}

#[tauri::command(async)]
fn read(state: State<AppState>, path: String) -> Result<ReadReply, Code> {
    state.with_workspace(|workspace| {
        workspace
            .read(&path)
            .map(|(text, revision)| ReadReply { text, revision })
    })
}

#[tauri::command(async)]
fn save(
    state: State<AppState>,
    path: String,
    text: String,
    revision: String,
) -> Result<SaveReply, Code> {
    state.with_workspace(|workspace| {
        workspace
            .save(&path, &text, &revision)
            .map(|revision| SaveReply { revision })
    })
}

#[tauri::command(async)]
fn create(state: State<AppState>, path: String, text: String) -> Result<SaveReply, Code> {
    state.with_workspace(|workspace| {
        workspace
            .create(&path, &text)
            .map(|revision| SaveReply { revision })
    })
}

#[tauri::command(async)]
fn load_preferences(state: State<AppState>) -> Result<Option<String>, Code> {
    state.with_workspace(
        |workspace| match fs::read_to_string(state.preferences_file(workspace)) {
            Ok(text) => Ok(Some(text)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error.into()),
        },
    )
}

#[tauri::command(async)]
fn save_preferences(state: State<AppState>, value: String) -> Result<(), Code> {
    state.with_workspace(|workspace| {
        let file = state.preferences_file(workspace);
        fs::create_dir_all(file.parent().expect("preferences file has a parent"))?;
        fs::write(file, value)?;
        Ok(())
    })
}

/// Opens `folder` in the window, creating the window on first use. Unsaved input in the page of the
/// previous folder is discarded by the reload.
fn open_folder(app: &AppHandle, folder: &Path) -> workspace::Result<()> {
    let workspace = Workspace::open(folder)?;
    let title = workspace.root().file_name().map_or_else(
        || workspace.root().to_string_lossy().into_owned(),
        |name| name.to_string_lossy().into_owned(),
    );
    *app.state::<AppState>()
        .workspace
        .lock()
        .expect("workspace lock poisoned") = Some(workspace);
    let result = match app.get_webview_window(WINDOW) {
        Some(window) => window.set_title(&title).and_then(|()| window.reload()),
        None => build_window(app, &title).map(|_| ()),
    };
    result.map_err(|error| workspace::Error::Io(io::Error::other(error)))
}

fn build_window(app: &AppHandle, title: &str) -> tauri::Result<tauri::WebviewWindow> {
    let builder = WebviewWindowBuilder::new(app, WINDOW, WebviewUrl::default())
        .title(title)
        .inner_size(900.0, 700.0);
    #[cfg(debug_assertions)]
    let builder = debug::configure(builder);
    builder.build()
}

/// Asks for a folder. Quits when the first choice is cancelled: there is nothing to show without one.
fn choose_folder(app: &AppHandle) {
    let app = app.clone();
    app.dialog()
        .file()
        .set_title("Open Folder")
        .pick_folder(move |picked| {
            let opened = picked.map(|picked| {
                let folder = picked
                    .into_path()
                    .expect("the folder dialog returns a file path");
                let result = open_folder(&app, &folder);
                if result.is_ok() {
                    remember_folder(&app, &folder);
                }
                result
            });
            match opened {
                Some(Ok(())) => {}
                Some(Err(error)) => {
                    eprintln!("Markdown Outliner: cannot open the folder: {error:?}");
                    choose_folder(&app);
                }
                None if app.get_webview_window(WINDOW).is_none() => app.exit(0),
                None => {}
            }
        });
}

fn last_folder_file(app: &AppHandle) -> PathBuf {
    app.state::<AppState>().config_dir.join("last-folder")
}

fn remember_folder(app: &AppHandle, folder: &Path) {
    let file = last_folder_file(app);
    let result = fs::create_dir_all(&app.state::<AppState>().config_dir)
        .and_then(|()| fs::write(&file, folder.to_string_lossy().as_bytes()));
    if let Err(error) = result {
        eprintln!(
            "Markdown Outliner: cannot remember the folder in {}: {error}",
            file.display()
        );
    }
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let name = app.package_info().name.clone();
    let app_menu = SubmenuBuilder::new(app, &name)
        .about(None)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let open = MenuItemBuilder::with_id(OPEN_FOLDER, "Open Folder…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let file = SubmenuBuilder::new(app, "File")
        .item(&open)
        .separator()
        .close_window()
        .build()?;
    // The predefined items send the standard actions, so the shortcuts work in the web view's fields.
    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window = SubmenuBuilder::new(app, "Window")
        .minimize()
        .fullscreen()
        .build()?;
    MenuBuilder::new(app)
        .items(&[&app_menu, &file, &edit, &window])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .on_menu_event(|app, event| {
            if event.id() == OPEN_FOLDER {
                choose_folder(app);
            }
        })
        .setup(|app| {
            app.manage(AppState {
                workspace: Mutex::new(None),
                config_dir: app.path().app_config_dir()?,
            });
            let handle = app.handle();
            handle.set_menu(build_menu(handle)?)?;
            #[cfg(debug_assertions)]
            debug::setup(handle)?;
            if let Some(folder) = std::env::var_os(WORKSPACE_VARIABLE) {
                open_folder(handle, Path::new(&folder))
                    .map_err(|error| format!("cannot open {WORKSPACE_VARIABLE}: {error:?}"))?;
                return Ok(());
            }
            let remembered = fs::read_to_string(last_folder_file(handle)).ok();
            if remembered.is_some_and(|folder| open_folder(handle, Path::new(&folder)).is_ok()) {
                return Ok(());
            }
            choose_folder(handle);
            Ok(())
        });
    #[cfg(debug_assertions)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        list,
        read,
        save,
        create,
        load_preferences,
        save_preferences,
        debug::debug_log,
        debug::debug_window,
        debug::debug_snapshot,
    ]);
    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        list,
        read,
        save,
        create,
        load_preferences,
        save_preferences
    ]);
    builder
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
