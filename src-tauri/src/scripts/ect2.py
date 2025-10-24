import struct

def create_ktx_header(width, height, data_size):
    """
    Create a KTX header for ETC2 RGBA texture.
    """
    # KTX header fields
    identifier = b'\xABKTX 11\xBB\r\n\x1A\n'  # KTX file identifier
    endianness = 0x04030201  # little endian
    glType = 0  # compressed
    glTypeSize = 1
    glFormat = 0  # compressed
    glInternalFormat = 0x9278  # GL_COMPRESSED_RGBA8_ETC2_EAC
    glBaseInternalFormat = 0x1908  # GL_RGBA
    pixelWidth = width
    pixelHeight = height
    pixelDepth = 0
    numberOfArrayElements = 0
    numberOfFaces = 1
    numberOfMipmapLevels = 1
    bytesOfKeyValueData = 0

    header = struct.pack(
        "<12s13I",
        identifier,
        endianness,
        glType,
        glTypeSize,
        glFormat,
        glInternalFormat,
        glBaseInternalFormat,
        pixelWidth,
        pixelHeight,
        pixelDepth,
        numberOfArrayElements,
        numberOfFaces,
        numberOfMipmapLevels,
        bytesOfKeyValueData,
    )
    return header

def write_ktx_file(filename, width, height, etc2_rgba_data):
    """
    Create and write a KTX file for ETC2 RGBA data.
    """
    header = create_ktx_header(width, height, len(etc2_rgba_data))
    # Mipmap level size (4 bytes, little endian)
    mipmap_size = struct.pack("<I", len(etc2_rgba_data))
    with open(filename, "wb") as f:
        f.write(header)
        f.write(mipmap_size)
        f.write(etc2_rgba_data)

# Example usage:
if __name__ == "__main__":
    width, height = 128, 128  # your texture resolution
    f = open('/Users/wzh/Library/Application Support/com.dont-starve-asset-archive.dev/test', 'rb')
    etc2_rgba_data = f.read()
    write_ktx_file("texture2.ktx", width, height, etc2_rgba_data)