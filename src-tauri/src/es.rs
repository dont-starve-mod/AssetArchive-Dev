#[allow(unused_imports)]
#[allow(dead_code)]
pub mod es_handler {
    use std::fs::create_dir_all;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::Mutex;
    use once_cell::sync::Lazy;
    use tauri::App;

    static ES_BIN_PATH: Lazy<Mutex<PathBuf>> = Lazy::new(||
      Mutex::new(PathBuf::new())
    );  

    #[cfg(target_os="windows")]
    pub fn init_es(app: tauri::App) -> Result<(), String> {
        let app_data_dir = app.path_resolver().app_data_dir()
            .ok_or("Failed to get app_data_dir".to_string())?;
        let bin_dir = app_data_dir.join("bin").join("es");
        create_dir_all(&bin_dir)
            .map_err(|e|format!("Failed to create bin dir: {} {}", bin_dir.display(), e))?;
        
        let unpack_file = |name: &str, bytes: &[u8]| -> Result<(), String>{
            let path = bin_dir.join(name);
            std::fs::write(path, bytes).map_err(|e|format!("Error in installing es.exe [{}]: {}", name, e))
        };

        unpack_file("es.exe", include_bytes!("../bin/es/es.exe"))?;
        unpack_file("license.txt", include_bytes!("../bin/es/license.txt"))?;

        ES_BIN_PATH.lock().unwrap().clone_from(&bin_dir.join("es.exe"));
        Ok(())
    }

    pub fn search(path: &str) -> String {
        match Command::new(ES_BIN_PATH.lock().unwrap().as_path())
            .args(["-r", path, "-case", "/a-d", "-match-path"])
            .output() {
            Ok(out) => format!("{} / {}", 
                String::from_utf8(out.stdout).unwrap_or("".into()), 
                String::from_utf8(out.stderr).unwrap_or("".into())),
            Err(e) => {
                eprintln!("Error in running es.exe: {}", e);
                "".into()
            },
        }
    }
}