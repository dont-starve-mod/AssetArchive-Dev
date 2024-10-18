pub mod lua_filesystem {
    use std::ffi::{OsStr, OsString};
    use std::fs::{self, File};
    use std::io::{self, Read, Seek, SeekFrom, Cursor};
    use std::convert::TryInto;
    use std::path::PathBuf;
    #[cfg(unix)]
    use std::os::fd::{RawFd, AsRawFd, OwnedFd, FromRawFd};
    #[cfg(unix)]
    use libc;
    #[cfg(windows)]
    use std::os::windows::io::{RawHandle, AsRawHandle, OwnedHandle, FromRawHandle};
    use image::EncodableLayout;
    use rlua::{Value, Function, MetaMethod, UserData, UserDataMethods, Table, Context, FromLua, AnyUserData};
    use rlua::Value::Nil;
    use rlua::prelude::{LuaResult, LuaString, LuaError};

    #[repr(C)]
    #[derive(Clone)]
    enum DataMode {
        LittleEndian = 0,
        BigEndian = 1,
    }

    impl<'lua> FromLua<'lua> for DataMode {
        fn from_lua(lua_value: Value<'lua>, lua: Context<'lua>) -> LuaResult<Self> {
            match u8::from_lua(lua_value, lua) {
                Ok(0)=> Ok(DataMode::LittleEndian),
                Ok(1)=> Ok(DataMode::BigEndian),
                Ok(_)=> Err(LuaError::FromLuaConversionError{
                    from: "(lua)",
                    to: "DataMode",
                    message: Some("DataMode must be 0(big-endian) or 1(little-endian)".to_string())
                }),
                Err(e)=> Err(e)
            }
        }
    }

    trait ReadStreamTrait: Read {
        /// skip bytes of exact length
        fn seek_forward(&mut self, len: i64) -> io::Result<u64>;

        /// reset cursor
        fn rewind(&mut self) -> io::Result<()>;
        
        /// set cursor position
        fn seek_to(&mut self, _: u64) {

        }

        /// find next string in file (TODO: check performance)
        fn seek_to_string(&mut self, neddle: &str) -> bool {
            let bytes = neddle.as_bytes();
            let mut index = 0;
            let max_index = bytes.len();
            let mut buf: [u8; 1] = [0];
            loop {
                match self.read(&mut buf) {
                    Ok(0) => return false,
                    Ok(_) => {
                        if buf[0] == bytes[index] {
                            index += 1;
                            if index == max_index {
                                return true;
                            }
                        }
                        else{
                            index = 0;
                        }
                    },
                    Err(_) => return false,
                }
            }
        }

        /// get file description for drop
        #[cfg(unix)]
        fn get_fd(&self) -> Option<RawFd> {
            None
        }

        #[cfg(windows)]
        fn get_fd(&self) -> Option<RawHandle> {
            None
        }
    }
    struct BytesReader {
        index: usize,
        bytes: Vec<u8>,
    }

    impl Read for BytesReader {
        #[inline]
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            let amt = usize::min(buf.len(), self.bytes.len() - self.index);
            buf[..amt].copy_from_slice(&self.bytes[self.index..self.index + amt]);
            self.index += amt;
            Ok(amt)
        }
        #[inline]
        fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
            let len = buf.len();
            if len > self.bytes.len() - self.index {
                Err(io::Error::from(io::ErrorKind::UnexpectedEof))
            }
            else{
                buf[..len].copy_from_slice(&self.bytes[self.index..self.index+len]);
                self.index += len;
                Ok(())
            }
        }
    }

    impl ReadStreamTrait for File {
        fn seek_forward(&mut self, len: i64) -> io::Result<u64>{
            match self.seek(SeekFrom::Current(len)) {
                Ok(pos)=> Ok(pos),
                Err(e)=> Err(e),
            }
        }

        fn rewind(&mut self) -> io::Result<()> {
            <Self as Seek>::rewind(self)
        }

        #[cfg(unix)]
        fn get_fd(&self) -> Option<RawFd> {
            Some(self.as_raw_fd()) 
        }

        #[cfg(windows)]
        fn get_fd(&self) -> Option<RawHandle> {
            Some(self.as_raw_handle())
        }

        fn seek_to(&mut self, pos: u64){
            self.seek(SeekFrom::Start(pos)).unwrap_or(0);
        }
    }

    impl ReadStreamTrait for BytesReader {
        fn seek_forward(&mut self, len: i64) -> io::Result<u64> {
            if len < 0 {
                return Err(io::Error::new(io::ErrorKind::Unsupported, "Cannot seek backward"));
            }
            self.index += len as usize;
            Ok(self.index as u64)
        }

        fn seek_to(&mut self, pos: u64) {
            self.index = usize::min(pos as usize, self.bytes.len());
        }

        fn rewind(&mut self) -> io::Result<()> {
            self.index = 0;
            Ok(())
        }
    }

    impl ReadStreamTrait for Cursor<Vec<u8>> {
        fn seek_forward(&mut self, len: i64) -> io::Result<u64> {
            match self.seek(SeekFrom::Current(len)) {
                Ok(pos)=> Ok(pos),
                Err(e)=> Err(e),
            }
        }

        fn rewind(&mut self) -> io::Result<()> {
            <Self as Seek>::rewind(self)
        }
    }

    struct ReadStream
    {
        inner: Box<dyn ReadStreamTrait>,
        len: Option<usize>,
        data_mode: DataMode,
        file_path: Option<String>,
    }

    unsafe impl Send for ReadStream{ }

    impl ReadStream {
        fn open(path: &str) -> Option<Self> {
            let f: File = match fs::OpenOptions::new().read(true).open(path) {
                Ok(f)=> f,
                Err(e)=> {
                    eprintln!("ReadStream: cannot read file: {:?} {:?}", path, e);
                    return None
                },
            };
            Some(ReadStream {
                inner: Box::new(f),
                len: None,
                data_mode: DataMode::LittleEndian,
                file_path: Some(path.to_string()),
            })
        }

        fn wrap_bytes(bytes: Vec<u8>) -> Self {
            let len = bytes.len();
            ReadStream {
                inner: Box::new(Cursor::new(bytes)),
                len: Some(len),
                data_mode: DataMode::LittleEndian,
                file_path: None,
            }
        }

        fn set_le_mode(&mut self) {
            self.data_mode = DataMode::LittleEndian;
        }

        fn set_be_mode(&mut self) {
            self.data_mode = DataMode::BigEndian;
        }

        fn read_exact(&mut self, len: usize) -> Result<Vec<u8>, std::io::Error> {
            let mut buf = vec![0; len];
            match self.inner.read_exact(&mut buf) {
                Ok(_)=> Ok(buf),
                Err(e)=> Err(e),
                // Err(e)=> {println!("{:?}", e); Ok(buf)},
            }
        }

        fn read(&mut self, len: usize) -> Result<Vec<u8>, std::io::Error> {
            let mut buf = vec![0; len];
            match self.inner.read(&mut buf) {
                Ok(n)=> {
                    buf.resize(n, 0);
                    Ok(buf)
                },
                Err(e)=> Err(e),
                // Err(e)=> {println!("{:?}", e); Ok(buf)},
            }
        }

        fn read_u32(&mut self) -> Option<u32> {
            match self.read_exact(4) {
                Ok(bytes)=> {
                    let bytes: [u8; 4] = bytes.try_into().unwrap();
                    match self.data_mode {
                        DataMode::BigEndian => Some(u32::from_be_bytes(bytes)),
                        DataMode::LittleEndian => Some(u32::from_le_bytes(bytes)),
                    }
                },
                Err(_)=> None
            }
        }

        fn read_f32(&mut self) -> Option<f32> {
            match self.read_exact(4) {
                Ok(bytes)=> {
                    let bytes: [u8; 4] = bytes.try_into().unwrap();
                    match self.data_mode {
                        DataMode::BigEndian => Some(f32::from_be_bytes(bytes)),
                        DataMode::LittleEndian => Some(f32::from_le_bytes(bytes)),
                    }
                },
                Err(_)=> None
            }
        }

        fn read_f32_matrix(&mut self, num: usize) -> Option<Vec<f32>> {
            match self.read_exact(num* 4) {
                Ok(bytes)=> {
                    Some(bytes.chunks_exact(4)
                        .map(|v| f32::from_le_bytes(v.try_into().unwrap())) // only for anim.bin loader
                        .collect())
                },
                Err(_)=> None
            }
        }

        fn read_u16(&mut self)-> Option<u16> {
            match self.read_exact(2) {
                Ok(bytes)=> {
                    let bytes: [u8; 2] = bytes.try_into().unwrap();
                    match self.data_mode {
                        DataMode::BigEndian => Some(u16::from_be_bytes(bytes)),
                        DataMode::LittleEndian => Some(u16::from_le_bytes(bytes)),
                    }
                },
                Err(_)=> None
            }
        }

        fn read_u64(&mut self)-> Option<u64> {
            match self.read_exact(8) {
                Ok(bytes)=> {
                    let bytes: [u8; 8] = bytes.try_into().unwrap();
                    match self.data_mode {
                        DataMode::BigEndian => Some(u64::from_be_bytes(bytes)),
                        DataMode::LittleEndian => Some(u64::from_le_bytes(bytes)),
                    }
                },
                Err(_)=> None
            }
        }

        fn read_u8(&mut self)-> Option<u8> {
            match self.read_exact(1) {
                Ok(bytes)=> {
                    Some(bytes[0])
                },
                Err(_)=> None
            }
        }
    }

    impl UserData for ReadStream {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method_mut("setmode", |_, fs: &mut Self, mode: DataMode|{
                match mode {
                    DataMode::BigEndian => fs.set_be_mode(),
                    DataMode::LittleEndian => fs.set_le_mode(),
                }
                Ok(())
            });
            _methods.add_method_mut("read_u32", |_, fs: &mut Self, ()|{
                Ok(fs.read_u32())
            });
            _methods.add_method_mut("read_f32", |_, fs: &mut Self, ()|{
                Ok(fs.read_f32())
            });
            _methods.add_method_mut("read_f32_matrix", |_, fs: &mut Self, num: usize|{
                Ok(fs.read_f32_matrix(num))
            });
            _methods.add_method_mut("read_u64", |_, fs: &mut Self, ()|{
                Ok(fs.read_u64())
            });
            _methods.add_method_mut("read_u16", |_, fs: &mut Self, ()|{
                Ok(fs.read_u16())
            });
            _methods.add_method_mut("read_u8", |_, fs: &mut Self, ()|{
                Ok(fs.read_u8())
            });
            _methods.add_method_mut("read_exact", |lua_ctx, fs: &mut Self, len: usize|{
                if let Ok(buf) = fs.read_exact(len) {
                    Ok(Some(lua_ctx.create_string(buf.as_bytes())?))
                }
                else{
                    Ok(None)
                }
            });
            _methods.add_method_mut("read", |lua_ctx, fs: &mut Self, len: usize|{
                if let Ok(buf) = fs.read(len) {
                    if buf.is_empty() {
                        Ok(None)
                    }
                    else{
                        Ok(Some(lua_ctx.create_string(&buf[..])?))
                    }
                }
                else {
                    Ok(None)
                }
            });
            _methods.add_method_mut("seek_forward", |_, fs: &mut Self, len: i64|{
                match fs.inner.seek_forward(len) {
                    Ok(pos) => Ok(Some(pos)),
                    Err(_) => Ok(None)
                }
            });
            _methods.add_method_mut("seek_to", |_, fs: &mut Self, pos: u64|{
                fs.inner.seek_to(pos);
                Ok(Nil)
            });
            _methods.add_method_mut("seek_to_string", |_, fs: &mut Self, neddle: String|{
                Ok(fs.inner.seek_to_string(&neddle))
            });
            _methods.add_method_mut("next_line", |lua_ctx, fs: &mut Self, ()|{
                let mut result = Vec::<u8>::with_capacity(512);
                let mut buf = [0];
                loop {
                    match fs.inner.read_exact(&mut buf) {
                        Ok(())=> {
                            result.push(buf[0]);
                            if buf[0] == b'\n' {
                                break;
                            }
                        },
                        Err(_)=> return {
                            if result.is_empty() {
                                Ok(None)
                            }
                            else { 
                                Ok(Some(lua_ctx.create_string(result.as_bytes())?)) 
                            }
                        }
                    }
                };
                Ok(Some(lua_ctx.create_string(buf.as_bytes())?))
            });
            _methods.add_method_mut("rewind", |_, fs: &mut Self, ()|{
                fs.inner.rewind().map_err(|_|LuaError::RuntimeError("Failed to rewind file cursor".to_string()))
            });
            _methods.add_method("path", |_, fs: &Self, ()|{
                Ok(fs.file_path.clone())
            });
            _methods.add_method("size", |_, fs: &Self, ()|{
                Ok(fs.len)
            });
            _methods.add_method_mut("drop", |_, fs: &mut Self, ()|{
                if let Some(fd) = fs.inner.get_fd() {
                    // prevent double drop
                    fs.inner = Box::new(BytesReader{index: 0, bytes: Vec::<u8>::new()});
                    // #[cfg(unix)]
                    // drop(unsafe { OwnedFd::from_raw_fd(fd) });
                    // 
                    // 2024.10.18 bypass debug_assert_fd_is_open checking
                    // https://doc.rust-lang.org/src/std/os/fd/owned.rs.html#174-196
                    #[cfg(unix)]
                    let _ = unsafe {libc::close(fd)};
                    #[cfg(windows)]
                    drop(unsafe { OwnedHandle::from_raw_handle(fd)});
                };
                Ok(())
            });
            _methods.add_meta_method(MetaMethod::Index, |lua_ctx: Context, _, k: String|{
                let globals = lua_ctx.globals();
                let lua_registers = globals.get::<_, Table>("FileSystem")?
                    .get::<_, Table>("ReadStream__index")?;
                let func = lua_registers.get::<_, Function>(k)?;
                Ok(func)
            });
        }
    }

    #[derive(PartialEq, Clone)]
    pub struct Path {
        inner: PathBuf
    }

    impl Path {
        pub fn new(path: PathBuf) -> Self {
            Path { inner: path }
        }

        pub fn get_inner(&self) -> PathBuf {
            self.inner.clone()
        }

        fn from(s: &str) -> Self {
            Path { inner: PathBuf::from(s)}
        }

        fn join(&self, s: String) -> Self {
            let p = PathBuf::from(&s);
            if p.is_relative() && !p.has_root() {
                Path { inner: self.inner.join(p) }
            }
            else {
                panic!("Join an absolute path is not allowed: {}", s);
            }
        }

        fn extension(&self) -> Option<String> {
            match self.inner.extension() {
                Some(ext)=> ext.to_str().map(|s| s.to_string()),
                None => None,
            }
        }

        #[inline]
        fn with_extension(&self, s: String) -> Self {
            Path { inner: self.inner.with_extension(s) }
        }

        #[inline]
        fn check_extention(&self, ext: &str) -> bool {
            match self.extension() {
                Some(s)=> s == ext,
                None => false
            }
        }

        #[inline]
        fn name(&self) -> Option<String> {
            self.inner.file_name().map(|s|s.to_string_lossy().to_string())
        }

        #[inline]
        fn with_name(&self, s: String) -> Self {
            Path { inner: self.inner.with_file_name(s) }
        }

        #[inline]
        fn is_dir(&self) -> bool {
            self.inner.is_dir()
        }

        #[inline]
        fn is_file(&self) -> bool {
            self.inner.is_file()
        }

        #[inline]
        fn exists(&self) -> bool {
            self.inner.exists()
        }

        fn create_dir(&self) -> bool {
            if self.is_dir() {
                true
            }
            else {
                fs::create_dir_all(&self.inner).is_ok()
            }
        }

        #[inline]
        fn parent(&self) -> Self {
            match self.inner.parent() {
                Some(path)=> Path::new(path.to_path_buf()),
                None => Path::from(""),
            }
        }

        fn iter_dir(&self) -> Vec<Self> {
            let mut result = Vec::new();
            if let Ok(dir) = self.inner.read_dir() {
                dir.for_each(|entry|{
                    if let Ok(entry) = entry {
                        result.push(Path{ inner: entry.path() });
                    }
                });
            };
            result
        }
        
        fn open_and_write(&self, content: Option<LuaString>) -> Result<(), ()> {
            match content {
                Some(s)=> fs::write(&self.inner, s.as_bytes()).map_err(|_|()),
                None=> fs::remove_file(&self.inner).map_err(|_|()),
            }
        }

        fn open_and_read(&self) -> Result<Vec<u8>, ()> {
            fs::read(&self.inner).map_err(|_|())
        }
    }

    impl std::fmt::Display for Path {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "{}", self.inner.to_string_lossy())
        }
    }

    pub trait ConvertArgToString {
        fn to_string(&self) -> LuaResult<String>;
    }

    impl ConvertArgToString for Value<'_> {
        fn to_string(&self) -> LuaResult<String> {
            match self {
                Value::String(s)=> Ok(String::from_utf8_lossy(s.as_bytes()).to_string()),
                Value::UserData(v)=> {
                    match v.borrow::<Path>() {
                        Ok(path)=> Ok(path.to_string()),
                        _ => Err(LuaError::FromLuaConversionError { from: "(lua)", to: "path|string", message: None })
                    }
                },
                _ => Err(LuaError::FromLuaConversionError { from: "(lua)", to: "path|string", message: None })
            }
        }
    }
    pub trait ConvertToOsString {
        fn to_os_string(&self) -> OsString;
    }

    impl ConvertToOsString for Path {
        fn to_os_string(&self) -> OsString {
            self.inner.as_os_str().to_os_string()
        }
    }

    impl ConvertToOsString for LuaString<'_> {
        fn to_os_string(&self) -> OsString {
            OsString::from(self.to_str().unwrap_or(""))
        }
    }
    
    impl UserData for Path {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method("exists", |_, path: &Self, ()|{
                Ok(path.exists())
            });
            _methods.add_method("is_file", |_, path: &Self, ()|{
                Ok(path.is_file())
            });
            _methods.add_method("is_dir", |_, path: &Self, ()|{
                Ok(path.is_dir())
            });
            _methods.add_method("read_to_string", |_, path: &Self, ()|{
                fs::read_to_string(&path.inner).map_err(|e| LuaError::RuntimeError(format!("Failed to read file: {}", e)))
            });
            _methods.add_method("write", |_, path: &Self, content: LuaString|{
                fs::write(&path.inner, content.as_bytes()).map_err(|e| LuaError::RuntimeError(format!("Failed to write file: {}", e)))
            });
            #[cfg(unix)]
            _methods.add_method("set_mode", |_, path: &Self, mode: u32|{
                use std::os::unix::fs::PermissionsExt;
                match path.inner.metadata() {
                    Ok(meta) => {
                        let mut p = meta.permissions();
                        p.set_mode(mode);
                        std::fs::set_permissions(path.inner.clone(), p).ok();
                    },
                    Err(e)=> println!("Failed to set mode: {}", e),
                };
                Ok(())
            });
            #[allow(unused_variables)]
            #[cfg(windows)]
            _methods.add_method("set_mode", |_, path: &Self, ()|{
                Ok(())
            });
            _methods.add_method("delete", |_, path: &Self, ()|{
                fs::remove_file(&path.inner).map_err(|e| LuaError::RuntimeError(format!("Failed to delete file: {}", e)))
            });
            _methods.add_method("create_dir", |_, path: &Self, ()|{
                Ok(path.create_dir())
            });
            _methods.add_method("parent", |_, path: &Self, ()|{
                Ok(path.parent())
            });
            _methods.add_method("name", |_, path: &Self, ()|{
                Ok(path.inner.file_name().map(|s|s.to_string_lossy().to_string()))
            });
            _methods.add_method("stem", |_, path: &Self, ()|{
                Ok(path.inner.file_stem().map(|s|s.to_string_lossy().to_string()))
            });
            _methods.add_method("with_name", |_, path: &Self, name: String|{
                Ok(path.with_name(name))
            });
            _methods.add_method("mtime", |_, path: &Self, ()|{
                Ok(match fs::metadata(&path.inner) {
                    Ok(meta)=> match meta.modified() {
                        Ok(mtime)=> Some(mtime.duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs()),
                        Err(_)=> None,
                    },
                    Err(_)=> None,
                })
            });
            _methods.add_method("iter", |_, path: &Self, ()|{
                Ok(path.iter_dir())
            });
            _methods.add_method("iter_file", |_, path: &Self, options: Option<Table>|{
                let (extension, ensure_ascii) = match options {
                    Some(t)=> {
                        let extension = t.get::<_, String>("extension").ok();
                        let ensure_ascii = t.get::<_, bool>("ensure_ascii").ok().unwrap_or(true);
                        (extension, ensure_ascii)
                    },
                    None=> (None, true)
                };
                let filter_predicate = |p: &Path| -> bool {
                    if p.is_file() {
                        if let Some(ext) = &extension {
                            if !p.check_extention(ext) {
                                return false;
                            }
                        }
                        else if ensure_ascii && p.get_inner()
                            .file_name().unwrap_or(OsStr::new("")).to_str().is_none() {
                            return false;
                        }
                        true
                    }
                    else {
                        false
                    }
                };
                Ok(path.iter_dir()
                    .iter()
                    .filter(|p|filter_predicate(p))
                    .cloned()
                    .collect::<Vec<_>>())
            });
            _methods.add_method("iter_file_with_extension", |_, path: &Self, mut ext: String|{
                if ext.starts_with('.') { ext = ext.split_off(1) }
                let ext_str = &ext[..];
                Ok(path.iter_dir()
                    .iter()
                    .filter(|p|p.is_file() && p.check_extention(ext_str))
                    .filter(|p|p.name().unwrap_or("".to_string()).is_ascii())
                    .cloned()
                    .collect::<Vec<_>>())
            });
            _methods.add_method("extention", |_, path: &Self, ()|{
                Ok(path.extension())
            });
            _methods.add_method("check_extention", |_, path: &Self, mut ext: String|{
                if ext.starts_with('.') {
                    Ok(path.extension() == Some(ext.split_off(1)))
                }
                else {
                    Ok(path.extension() == Some(ext))
                }
            });
            _methods.add_method("with_extension", |_, path: &Self, mut ext: String|{
                if ext.starts_with('.') {
                    Ok(path.with_extension(ext.split_off(1)))
                }
                else {
                    Ok(path.with_extension(ext))
                }
            });
            _methods.add_method("as_string", |_, path: &Self, ()|{
                Ok(path.to_string())
            });
            // utf-8 safe converter
            // _methods.add_method("serde_json", |_, path, ()|{
            //     use serde::Serialize;
            //     let object = match path.inner.to_str() {
            //         Some(s)=> object!{
            //             is_utf8: true,
            //             string: s,
            //         },
            //         None=> object!{
            //             is_utf8: false,
            //             value: path.inner,
            //         }
            //     };
            //     Ok(object.to_string())
            // });
            _methods.add_meta_method(MetaMethod::ToString, |_, path: &Self, ()|{
                Ok(format!("Path<{}>", path))
            });
            _methods.add_meta_method(MetaMethod::Div, |_, path: &Self, s: String|{
                Ok(path.join(s))
            });
            _methods.add_meta_method(MetaMethod::Eq, |_, path: &Self, rhs: Self|{
                Ok(path == &rhs)
            });
        }
    }

    pub fn init(lua_ctx: Context) -> LuaResult<()> {
        let table = lua_ctx.create_table()?;
        table.set("CreateReader", lua_ctx.create_function(|_: Context, path: Value|{
            match path.to_string() {
                Ok(s)=> Ok(ReadStream::open(s.as_str())),
                Err(e)=> Err(e)
            }
        })?)?;
        table.set("CreateBytesReader", lua_ctx.create_function(|_, bytes: LuaString|{
            Ok(ReadStream::wrap_bytes(Vec::<u8>::from(bytes.as_bytes())))
        })?)?;
        table.set("SaveString", lua_ctx.create_function(|lua: Context, (path, content): (String, Option<LuaString>)|{
            match lua.globals().get::<_, Path>("APP_DATA_DIR") {
                Ok(data)=> Ok(data.join(path).open_and_write(content).is_ok()), // TODO: 检查windows平台对分隔符是否敏感
                Err(_)=> Ok(false)
            }
        })?)?;
        table.set("GetString", lua_ctx.create_function(|lua: Context, path: String|{
            match lua.globals().get::<_, Path>("APP_DATA_DIR") {
                Ok(data)=> match data.join(path).open_and_read() {
                    Ok(s)=> Ok(Some(lua.create_string(&s)?)),
                    Err(_)=> Ok(None),
                },
                Err(_)=> Ok(None)
            }
        })?)?;
        table.set("ListDir", lua_ctx.create_function(|_: Context, path: String|{
            Ok(Path::from(&path).iter_dir())
        })?)?;
        table.set("WorkDir", lua_ctx.create_function(|_: Context, ()|{
            Ok(Path::from(std::env::current_dir().unwrap()
                .as_os_str()
                .to_str().unwrap()))
        })?)?;
        table.set("Path", lua_ctx.create_function(|_: Context, path: String|{
            Ok(Path::from(&path))
        })?)?;
        table.set("Filenamify", lua_ctx.create_function(|_, path: String|{
            Ok(filenamify::filenamify(path))
        })?)?;
        table.set("IsFile", lua_ctx.create_function(|_, path: String|{
            Ok(Path::from(&path).is_file())
        })?)?;
        table.set("IsDir", lua_ctx.create_function(|_, path: String|{
            Ok(Path::from(&path).is_dir())
        })?)?;
        table.set("GetInfo", lua_ctx.create_function(|lua, path: String|{
            let path = Path::from(&path);
            let info = lua.create_table()?;
            info.set("is_file", path.is_file())?;
            info.set("is_dir", path.is_dir())?;
            info.set("exists", path.exists())?;
            Ok(info)
        })?)?;
        table.set("DynLoader_Ctor", lua_ctx.create_function(|lua: Context, (loader, fs): (Table, AnyUserData)|{
            fs.borrow_mut::<ReadStream>().and_then(|mut fs|{
                let mut buf = Vec::with_capacity(10000);
                if fs.inner.read_to_end(&mut buf).is_err() {
                    loader.set("error", "Cannot read from fs")?;
                    return Ok(Nil)
                }

                if let Some(fs) = read_dyn(buf) {
                    let globals = lua.globals();
                    let ziploader = globals.get::<_, Table>("ZipLoader")?;
                    let ctor = ziploader.get::<_, Function>("_ctor")?;
                    let filter = ziploader.get::<_, Table>("NAME_FILTER")?.get::<_, Function>("ALL")?;
                    loader.set("is_dyn", true)?;
                    ctor.call::<_, Value>((loader, fs, filter))?;
                }
                else {
                    loader.set("error", "Dyn file loading not supported")?;
                }
                Ok(Nil)
            })
        })?)?;

        table.set("ReadStream__index", lua_ctx.create_table()?)?;

        table.set("DATAMODE_BE", DataMode::BigEndian as u8)?;
        table.set("DATAMODE_LE", DataMode::LittleEndian as u8)?;

        let globals = lua_ctx.globals();
        globals.set("FileSystem", table)?;
        Ok(())
    }

    // dyn loader (secret vars is defined in env)
    const DYN_INDEX: Option<&'static str> = option_env!("DYN_INDEX"); // some string
    const DYN_MAGIC_NUMBER: Option<&'static str> = option_env!("DYN_MAGIC_NUMBER"); // some string

    fn read_dyn(mut bytes: Vec<u8>) -> Option<ReadStream> {
        // skip this feature if magic number not provided
        // compiler can work though
        let dyn_index_s = DYN_INDEX.unwrap_or("");
        let dyn_magic_number_s = DYN_MAGIC_NUMBER.unwrap_or("");
        if dyn_index_s.is_empty() || dyn_magic_number_s.is_empty() {
            return None;
        }
        // parse
        // need a exact correct value to run properly (defined in env or github action)
        // if you don't know the value, leave `DYN_INDEX` and `DYN_MAGIC_NUMBER` empty
        let dyn_index = dyn_index_s.chars()
            .map(|i|i.to_string().parse::<u8>().unwrap() as usize)
            .collect::<Vec<usize>>();
        let dyn_magic_number = dyn_magic_number_s.to_string().parse::<u8>().unwrap();
        let chunk_size = dyn_index_s.len();

        let len = bytes.len();
        let len_aligned = if len % chunk_size == 0 { len } else { (len / chunk_size + 1) * chunk_size };
        if len_aligned > len {
            bytes.extend_from_slice(&vec![0; len_aligned - len]);
        }

        for chunk in bytes.chunks_exact_mut(chunk_size) {
            chunk.to_vec().iter()
                .zip(&dyn_index)
                .for_each(|(v, index)| chunk[*index] = v ^ (dyn_magic_number + *index as u8));
        }
    
        Some(ReadStream::wrap_bytes(bytes))
    }
    
}