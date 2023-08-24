fn main() {
    println!(r"cargo:rustc-link-search=native=fmod/bin");
    println!(r"cargo:rustc-link-lib=fmodevent");
    println!(r"cargo:rustc-link-lib=fmodex");
}