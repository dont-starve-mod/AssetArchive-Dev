use std::path::{PathBuf, Path};
use std::process::{Child, Command, Stdio};
use crate::CommandExt;

#[allow(unreachable_code)]
fn get_bin_name() -> &'static str {
  #[cfg(target_os="macos")]
  {
    #[cfg(target_arch="aarch64")]
    return "meilisearch_mac_arm";
    #[cfg(target_arch="x86_64")]
    return "meilisearch_mac_x86";
  }
  #[cfg(target_os="windows")]
  {
    #[cfg(target_arch="x86")]
    return "meilisearch_win_x86.exe";
    #[cfg(target_arch="x86_64")]
    return "meilisearch_win_x64.exe";
  }
  unreachable!();
}

#[allow(unreachable_code)]
fn get_meilisearch_bytes() -> &'static [u8] {
  #[cfg(target_os="macos")]
  {
    #[cfg(target_arch="aarch64")]
    return include_bytes!("../bin/meilisearch/meilisearch_mac_arm");
    #[cfg(target_arch="x86_64")]
    return include_bytes!("../bin/meilisearch/meilisearch_mac_x86");
  }
  #[cfg(target_os="windows")]
  {
    #[cfg(target_arch="x86")]
    return include_bytes!("../bin/meilisearch/meilisearch_win_x86.exe");
    #[cfg(target_arch="x86_64")]
    return include_bytes!("../bin/meilisearch/meilisearch_win_x64.exe");
  }
  unreachable!();
}

fn get_license_bytes() -> &'static [u8] {
  include_bytes!("../bin/meilisearch/LICENSE")
}

fn unpack_meilisearch_binary(bin_dir: &Path) -> Result<(), String> {
  let unpack_file = |name: &str, bytes: &[u8]| -> Result<(), String>{
      let path = bin_dir.join(name);
      std::fs::write(path, bytes).map_err(|e|format!("Error in installing meilisearch [{}]: {}", name, e))
  };

  unpack_file(get_bin_name(), get_meilisearch_bytes())?;
  unpack_file("LICENSE", get_license_bytes())?;
  
  #[cfg(target_os="macos")]{
    let exec_path = bin_dir.join(get_bin_name());
    use std::os::unix::fs::PermissionsExt;
    match exec_path.metadata() {
        Ok(meta)=> {
            let mut p = meta.permissions();
            p.set_mode(0o777);
            std::fs::set_permissions(exec_path, p).ok();
        },
        Err(e)=> println!("Failed to set mode: {}", e),
    }
  }
  Ok(())
}

/// find a useable localhost addr
fn get_addr() -> String {
  use std::net::TcpListener;
  TcpListener::bind("127.0.0.1:0").unwrap()
    .local_addr()
    .unwrap()
    .to_string()
}

pub struct MeilisearchChild {
  inner: Child,
  addr: String,
}

impl MeilisearchChild {
  pub fn new(bin_dir: PathBuf) -> Result<Self, String> {
    unpack_meilisearch_binary(bin_dir.as_path())?;
    std::env::set_current_dir(&bin_dir)
      .map_err(|e|e.to_string())?;
    let addr = get_addr();
    let child = Command::new(bin_dir.join(get_bin_name()))
      .set_no_console()
      .args(["--env", "development"])
      .args(["--log-level", "WARN"])
      .args(["--http-addr", addr.as_str()])
      .stdin(Stdio::piped())
      .spawn()
      .map_err(|e|format!("Failed to spawn meilisearch process: {}", e))?;
    
    Ok(MeilisearchChild { inner: child, addr })
  }

  pub fn get_addr(&self) -> &str {
    &self.addr
  }

  pub fn kill(&mut self) -> Result<(), String> {
    self.inner.kill().map_err(|e|e.to_string())
  }
}

impl Drop for MeilisearchChild {
  fn drop(&mut self) {
      self.kill().ok();
  }
}

pub mod meilisearch_handler {
  use crate::Meilisearch;

  fn check_process(state: &tauri::State<'_, Meilisearch>) -> Result<(), String> {
    match state.meilisearch.lock().unwrap().as_ref() {
      Some(_)=> Ok(()),
      None=> Err("Meilisearch child process not exists".into()), 
    }
  }

  #[tauri::command]
  pub fn meilisearch_get_addr(state: tauri::State<'_, Meilisearch>) -> Result<String, String> {
    check_process(&state)?;
    let addr = state.meilisearch.lock().unwrap().as_ref()
      .map(|s|s.get_addr())
      .unwrap_or("")
      .to_string();
    Ok(addr)
  }
}