pub mod lua_filesystem {
    use std::fs::{self, File};
    use std::io::{self, Read, Seek, SeekFrom, Cursor};
    use std::convert::TryInto;
    use std::error::Error;
    use std::path::PathBuf;
    #[cfg(unix)]
    use std::os::unix::ffi::OsStringExt;
    #[cfg(unix)]
    use std::os::fd::{RawFd, AsRawFd, OwnedFd, FromRawFd};
    #[cfg(windows)]
    use std::os::windows::io::{RawHandle, AsRawHandle, OwnedHandle, FromRawHandle};
    use rlua::{Function, Lua, MetaMethod, UserData, UserDataMethods, Variadic, Table, Context, AnyUserData};
    use rlua::Value;
    use rlua::Value::Nil;
    use rlua::{FromLua, ToLua};
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
        /// 跳过len个字节
        fn seek_forward(&mut self, len: i64) -> io::Result<u64>;

        /// 设置指针位置
        fn seek_to(&mut self, _: u64) -> () { }

        /// 查找下一个标志符, 注意该方法可能有性能问题
        fn seek_to_string(&mut self, flag: &str) -> bool {
            let bytes = flag.as_bytes();
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
                    Err(e) => return false,
                }
            }
        }

        /// 获取文件描述符, 该函数用于手动释放文件
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
        #[cfg(unix)]
        fn get_fd(&self) -> Option<RawFd> {
            Some(self.as_raw_fd()) 
        }

        #[cfg(windows)]
        fn get_fd(&self) -> Option<RawHandle> {
            Some(self.as_raw_handle())
        }

        fn seek_to(&mut self, pos: u64) -> () {
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

        fn seek_to(&mut self, pos: u64) -> () {
            self.index = usize::min(pos as usize, self.bytes.len());
        }
    }

    impl ReadStreamTrait for Cursor<Vec<u8>> {
        fn seek_forward(&mut self, len: i64) -> io::Result<u64> {
            match self.seek(SeekFrom::Current(len)) {
                Ok(pos)=> Ok(pos),
                Err(e)=> Err(e),
            }
        }
    }

    struct ReadStream
    {
        f: Box<dyn ReadStreamTrait>,
        data_mode: DataMode,
    }

    unsafe impl Send for ReadStream{} // 这样才能转换为Lua类型

    impl ReadStream {
        fn open(path: &str) -> Option<Self> {
            let f: File = match fs::OpenOptions::new().read(true).open(path) {
                Ok(f)=> f,
                Err(_)=> {
                    // println!("ReadStream: cannot read file: {}", path);
                    return None
                },
            };
            Some(ReadStream {
                f: Box::new(f),
                data_mode: DataMode::LittleEndian,
            })
        }

        fn wrap_bytes(bytes: Vec<u8>) -> Self {
            ReadStream {
                // f: Box::new(BytesReader{index: 0, bytes}),
                f: Box::new(Cursor::<Vec<u8>>::new(bytes)),
                data_mode: DataMode::LittleEndian ,
            }
        }

        fn set_le_mode(&mut self) {
            self.data_mode = DataMode::LittleEndian;
        }

        fn set_be_mode(&mut self) {
            self.data_mode = DataMode::BigEndian;
        }

        fn read_exact(&mut self, len: usize) -> core::result::Result<Vec<u8>, std::io::Error> {
            let mut buf = Vec::<u8>::new();
            buf.resize(len, 0);
            match self.f.read_exact(&mut buf) {
                Ok(_)=> Ok(buf),
                Err(e)=> Err(e),
                // Err(e)=> {println!("{:?}", e); Ok(buf)},
            }
        }

        fn read(&mut self, len: usize) -> core::result::Result<Vec<u8>, std::io::Error> {
            let mut buf = Vec::<u8>::new();
            buf.resize(len, 0);
            match self.f.read(&mut buf) {
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
            _methods.add_method_mut("read_u16", |_, fs: &mut Self, ()|{
                Ok(fs.read_u16())
            });
            _methods.add_method_mut("read_exact", |lua_ctx, fs: &mut Self, len: usize|{
                if let Ok(buf) = fs.read_exact(len) {
                    Ok(Some(lua_ctx.create_string(&buf[..])?))
                }
                else{
                    Ok(None)
                }
            });
            _methods.add_method_mut("read", |lua_ctx, fs: &mut Self, len: usize|{
                if let Ok(buf) = fs.read(len) {
                    if buf.len() == 0 {
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
                match fs.f.seek_forward(len) {
                    Ok(pos) => Ok(Some(pos)),
                    Err(_) => Ok(None)
                }
            });
            _methods.add_method_mut("seek_to", |_, fs: &mut Self, pos: u64|{
                fs.f.seek_to(pos);
                Ok(Nil)
            });
            _methods.add_method_mut("seek_to_string", |_, fs: &mut Self, flag: String|{
                Ok(fs.f.seek_to_string(&flag))
            });
            _methods.add_method_mut("rewind", |_, fs: &mut Self, ()|{
                Ok(LuaError::RuntimeError("unimpliment...".into()))
            });
            _methods.add_method_mut("drop", |_, fs: &mut Self, ()|{
                match fs.f.get_fd() {
                    Some(fd)=> {
                        #[cfg(unix)]
                        drop(unsafe { OwnedFd::from_raw_fd(fd) });
                        #[cfg(windows)]
                        drop(unsafe { OwnedHandle::from_raw_handle(fd)});
                        // prevent second call for drop()
                        fs.f = Box::new(BytesReader{index: 0, bytes: Vec::<u8>::new()});
                    },
                    None => ()
                }
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

    pub struct Path {
        inner: PathBuf
    }

    impl Path {
        pub fn new(path: PathBuf) -> Self {
            Path { inner: path }
        }

        fn from(s: &str) -> Self {
            Path { inner: PathBuf::from(s)}
        }

        fn join(&self, s: String) -> Self {
            Path { inner: self.inner.join(s)}
        }

        fn extension(&self) -> Option<String> {
            match self.inner.extension() {
                Some(ext)=> if let Some(s) = ext.to_str(){
                    Some(s.to_string())
                } else { None },
                None => None,
            }
        }

        fn is_dir(&self) -> bool {
            self.inner.is_dir()
        }

        fn is_file(&self) -> bool {
            self.inner.is_file()
        }

        fn iter_dir(&self) -> Vec<Self> {
            let mut result = Vec::new();
            match self.inner.read_dir() {
                Ok(r)=> {
                    r.for_each(|entry|{
                        if let Ok(entry) = entry {
                            result.push(Path{ inner: entry.path() });
                        }
                    });
                },
                Err(_)=> ()
            };
            result
        }
        
        fn to_string(&self) -> String {
            self.inner.to_string_lossy().to_string()
        }
    }

    impl UserData for Path {
        fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method("is_file", |_, path: &Self, ()|{
                Ok(path.is_file())
            });
            _methods.add_method("is_dir", |_, path: &Self, ()|{
                Ok(path.is_dir())
            });
            _methods.add_method("iter", |_, path: &Self, ()|{
                Ok(path.iter_dir())
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
            _methods.add_meta_method(MetaMethod::ToString, |_, path: &Self, ()|{
                Ok(format!("Path<{}>", path.to_string()))
            });
            _methods.add_meta_method(MetaMethod::Div, |_, path: &Self, s: String|{
                Ok(path.join(s))
            });
        }
    }

    pub fn init(lua_ctx: Context) -> LuaResult<()> {
        let table = lua_ctx.create_table()?;
        table.set("CreateReader", lua_ctx.create_function(|lua: Context, path: Value|{
            if let Ok(s) = String::from_lua(path.clone(), lua) {
                Ok(ReadStream::open(&s))
            }else if let Ok(userdata) = AnyUserData::from_lua(path.clone(), lua){
                match userdata.borrow::<Path>() {
                    Ok(p) => Ok(ReadStream::open(&p.to_string())),
                    Err(_) => Err(LuaError::FromLuaConversionError {
                        from: "(lua)", 
                        to: "Path", 
                        message: Some("userdata type mismatch".to_string())
                    })
                }
            }
            else {
                Err(LuaError::FromLuaConversionError{
                    from: "(lua)",
                    to: "string|Path",
                    message: Some("Must pass in a string or a Path".to_string())
                })
            }
        })?)?;
        table.set("CreateBytesReader", lua_ctx.create_function(|_, bytes: LuaString|{
            Ok(ReadStream::wrap_bytes(Vec::<u8>::from(bytes.as_bytes())))
        })?)?;
        table.set("ListDir", lua_ctx.create_function(|_: Context, path: String|{
            Ok(Path::from(&path).iter_dir())
        })?)?;
        table.set("Path", lua_ctx.create_function(|_: Context, path: String|{
            Ok(Path::from(&path))
        })?)?;
        table.set("DynLoader_Ctor", lua_ctx.create_function(|lua: Context, (loader, path): (Table, String)|{
            if let Some(fs) = read_dyn(&path) {
                let globals = lua.globals();
                let ziploader = globals.get::<_, Table>("ZipLoader")?;
                let ctor = ziploader.get::<_, Function>("_ctor")?;
                let filter = ziploader.get::<_, Table>("NAME_FILTER")?.get::<_, Function>("ALL")?;
                ctor.call::<_, Value>((loader, fs, filter))?;
            }
            else {
                loader.set("error", "Dyn file loading not supported")?;
            }
            Ok(Nil)
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

    fn read_dyn(path: &str) -> Option<ReadStream> {
        // skip this feature if magic number not provided
        // compiler can work throgh
        let dyn_index_s = DYN_INDEX.unwrap_or("");
        let dyn_magic_number_s = DYN_MAGIC_NUMBER.unwrap_or("");
        if dyn_index_s.len() == 0 || dyn_magic_number_s.len() == 0 {
            return None;
        }
        // parse
        // need a exact correct value to run properly (defined in env/github action)
        // if you don't know the value, do not set env var `DYN_INDEX` and `DYN_MAGIC_NUMBER`
        let mut reader = match ReadStream::open(path) {
            Some(f)=> f,
            _ => return None
        };
        let dyn_index = dyn_index_s.chars()
            .map(|i|i.to_string().parse::<u8>().unwrap() as usize)
            .collect::<Vec<usize>>();
        let dyn_magic_number = dyn_magic_number_s.to_string().parse::<u8>().unwrap();
        let chunk_size = dyn_index_s.len();

        let mut buf = Vec::with_capacity(10000);
        if reader.f.read_to_end(&mut buf).is_err() {
            return None;
        }
        let len = buf.len();
        let len_aligned = if len % chunk_size == 0 { len } else { (len / chunk_size + 1) * chunk_size };
        if len_aligned > len {
            buf.extend_from_slice(&vec![0; len_aligned - len]);
        }
        for chunk in buf.chunks_mut(chunk_size) {
            chunk.to_vec().iter()
                .zip(&dyn_index)
                .for_each(|(v, index)| chunk[*index] = v ^ (dyn_magic_number + *index as u8));
        }
    
        Some(ReadStream::wrap_bytes(buf))
    }
    
}