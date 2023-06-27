use std::io::Read;

/// simple unzip
pub fn unzip(mut f: impl Read) -> Result<Vec<u8>, &'static str> {
  let mut buf2 = [0 as u8; 2];
  let mut buf4 = [0 as u8; 4];
  let mut buf8 = [0 as u8; 8];

  if f.read_exact(&mut buf4).is_err() || buf4 != [80, 75, 3, 4] {
    return Err("zip sig not match (PK\\3\\4)");
  }
  f.read_exact(&mut buf4).unwrap_or(());
  if f.read_exact(&mut buf2).is_err() || buf2 != [8, 0] {
    return Err("compress method not supported");
  }
  if f.read_exact(&mut buf8).is_err() { // mtime, crc
    return Err("unexpected EOF");
  }
  if f.read_exact(&mut buf4).is_err() {
    return Err("unexpected EOF");
  }
  let compressed_len = u32::from_le_bytes(buf4);
  if f.read_exact(&mut buf4).is_err() {
    return Err("unexpected EOF");
  }
  let raw_len = u32::from_le_bytes(buf4);
  f.read_exact(&mut buf4).unwrap_or(());
  // name
  if f.read_exact(&mut buf4).is_err() {
    return Err("unexpected EOF");
  }
  let name_len = u32::from_le_bytes(buf4);
  if name_len > 0 {
    let mut name_bytes = Vec::new();
    name_bytes.resize(name_len as usize, 0);
    if f.read_exact(&mut name_bytes).is_err() {
      return Err("unexpected EOF");
    }
    else {
      if match String::from_utf8(name_bytes) {
        Ok(s)=> s.contains("ffmpeg"),
        Err(_)=> return Err("invalid zip filename (not a UTF-8)"),
      } {
        println!("OKKKKK");
      }
    }
  }

  Ok(Vec::<u8>::new())
}