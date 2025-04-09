#[allow(unused_imports)]
pub mod select_handler {
  use tauri;
  use tauri::Manager;
  use std::fs::create_dir_all;
  use std::path::PathBuf;
  use std::sync::Mutex;
  use once_cell::sync::Lazy;

  #[allow(dead_code)]
  static SELECT_BIN_PATH: Lazy<Mutex<PathBuf>> = Lazy::new(||
    Mutex::new(PathBuf::new())
  );

  #[cfg(target_os="windows")]
  pub fn init_windows_select(app: &mut tauri::App) -> Result<(), String> {
    let app_data_dir = app.path_resolver().app_data_dir()
        .ok_or("Failed to get app_data_dir".to_string())?;
    let bin_dir = app_data_dir.join("bin").join("OpenFolderAndSelectItem");
    create_dir_all(bin_dir.clone())
      .map_err(|e|format!("Failed to create bin dir: {} {}", bin_dir.display(), e))?;
    
    let unpack_file = |name: &str, bytes: &[u8]| -> Result<(), String>{
        let path = bin_dir.join(name);
        std::fs::write(path, bytes).map_err(|e|format!("Error in installing OpenFolderAndSelectItem.exe [{}]: {}", name, e.to_string()))
    };
  
    #[cfg(target_arch="x86_64")]
    unpack_file("OpenFolderAndSelect.exe", include_bytes!("../bin/OpenFolderAndSelectItem/64-bit/OpenFolderAndSelect.exe"))?;
    #[cfg(target_arch="x86")]
    unpack_file("OpenFolderAndSelect.exe", include_bytes!("../bin/OpenFolderAndSelectItem/32-bit/OpenFolderAndSelect.exe"))?;

    SELECT_BIN_PATH.lock().unwrap().clone_from(&bin_dir.join("OpenFolderAndSelect.exe"));
    Ok(())
  }

  #[cfg(target_os="windows")]
  pub fn windows_select_file_in_folder(path: String) -> bool {
    use std::process::Command;
    use crate::CommandExt;

    let binpath = SELECT_BIN_PATH.lock().unwrap();
    let path = path.replace("/", "\\");
    Command::new(binpath.as_path())
      .set_no_console()
      .arg(&path)
      .status()
      .is_ok()
  }
}