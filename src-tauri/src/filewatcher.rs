use std::sync::mpsc::{channel, Sender, Receiver};
use std::sync::Mutex;
use std::path::{Path, PathBuf};
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config, Event, EventHandler};
use tauri::{Emitter, Manager};

struct FileEventHandler {
    tx: Sender<Vec<PathBuf>>,
}

impl EventHandler for FileEventHandler {
    fn handle_event(&mut self, event: notify::Result<Event>) {
        if let Ok(event) = event {
            self.tx.send(event.paths.clone()).unwrap();
        }
    }
}

pub struct FileWatcher {
    inner: Mutex<RecommendedWatcher>,
    rx: Mutex<Option<Receiver<Vec<PathBuf>>>>,
}

impl FileWatcher {
    pub fn new() -> Self {
        let config = Config::default()
            .with_poll_interval(std::time::Duration::from_secs(1))
            .with_follow_symlinks(false);
        let (tx, rx) = channel::<Vec<PathBuf>>();
        let handler = FileEventHandler{ tx };
        let mut watcher = RecommendedWatcher::new(handler, config).unwrap();
        Self {
            inner: Mutex::new(watcher),
            rx: Mutex::new(Some(rx)),
        }
    }

    pub fn watch(&self, path: &Path) {
        let mut watcher = self.inner.lock().unwrap();
        // this function failed on non-existing paths
        // ignore this error
        watcher.watch(path, RecursiveMode::NonRecursive).ok();
    }

    pub fn unwatch(&self, path: &Path) {
        let mut watcher = self.inner.lock().unwrap();
        watcher.unwatch(path).ok();
    }

    pub fn attach_app(&self, app: tauri::AppHandle) {
        let mut rx = self.rx.lock().unwrap();
        let rx = rx.take().expect("attach_app() called more than once");
        std::thread::spawn(move || {
            loop {
                match rx.recv() {
                    Ok(paths) => {
                        for path in paths {
                            log::info!("[WATCHER] File changed: {}", path.display());
                            app.emit("mod_file_changed", path).ok();
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }
}

pub fn watch(app: &tauri::AppHandle, path: &Path) {
    let state = app.state::<FileWatcher>();
    state.watch(path);
}

pub fn unwatch(app: &tauri::AppHandle, path: &Path) {
    let state = app.state::<FileWatcher>();
    state.unwatch(path);
}