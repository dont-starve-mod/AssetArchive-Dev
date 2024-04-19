function HexToRGB(hex)
    hex = hex:gsub("#","")
    return tonumber("0x"..hex:sub(1,2)), tonumber("0x"..hex:sub(3,4)), tonumber("0x"..hex:sub(5,6))
end

function ParseColorString(s)
    if #s > 100 then
        error("color specifier is too long")
    end
    s = s:lower()

    -- interal
    if COLOR_MAP[s] ~= nil then
        return ParseColorString(COLOR_MAP[s])
    end

    -- #fff, #fff0, #ff00ff, #ff00ff50
    local _, _, hex = s:find("^#([0-9a-f]+)$")
    if hex ~= nil then
        if #hex == 3 or #hex == 4 then
            hex = hex:gsub(".", "%1%1")
        end
        if #hex == 6 then
            return tonumber("0x"..hex:sub(1,2)), tonumber("0x"..hex:sub(3,4)), tonumber("0x"..hex:sub(5,6)), 255
        elseif #hex == 8 then
            return tonumber("0x"..hex:sub(1,2)), tonumber("0x"..hex:sub(3,4)), tonumber("0x"..hex:sub(5,6)), tonumber("0x"..hex:sub(7,8))
        else
            error("invalid hex color: "..s)
        end
    end

    -- rgb/rgba
    local _, _, rgba = s:find("^rgba?%([^()]+%)$")
    if rgba ~= nil then
        local function parse(s)
            local _, _, percent = s:find("(%d+)%%")
            if percent ~= nil then
                return math.floor(tonumber(percent)/100*255 + 0.5)
            end
            local num = tonumber(s)
            if num == nil then
                error("failed to parse number: "..s)
            end
            if s:find("%.") and num <= 1 then
                return math.floor(num*255 + 0.5)
            else
                return math.floor(num + 0.5)
            end
        end

        local parts = {}
        for part in rgba:gmatch("([^,%s]+)") do
            table.insert(parts, part)
        end
        if #parts == 3 or #parts == 4 then
            return parse(parts[1]), parse(parts[2]), parse(parts[3]),
                parse(parts[4] or "255")
        else
            error("invalid rgb/rgba color: "..s)
        end
    end

    error("unsupported color: "..s)
end 

COLOR_MAP = {
    -- X11 colour table from https://drafts.csswg.org/css-color-4/, with
    -- gray/grey spelling issues fixed.  This is a superset of HTML 4.0
    -- colour names used in CSS 1.
    aliceblue = "#f0f8ff",
    antiquewhite = "#faebd7",
    aqua = "#00ffff",
    aquamarine = "#7fffd4",
    azure = "#f0ffff",
    beige = "#f5f5dc",
    bisque = "#ffe4c4",
    black = "#000000",
    blanchedalmond = "#ffebcd",
    blue = "#0000ff",
    blueviolet = "#8a2be2",
    brown = "#a52a2a",
    burlywood = "#deb887",
    cadetblue = "#5f9ea0",
    chartreuse = "#7fff00",
    chocolate = "#d2691e",
    coral = "#ff7f50",
    cornflowerblue = "#6495ed",
    cornsilk = "#fff8dc",
    crimson = "#dc143c",
    cyan = "#00ffff",
    darkblue = "#00008b",
    darkcyan = "#008b8b",
    darkgoldenrod = "#b8860b",
    darkgray = "#a9a9a9",
    darkgrey = "#a9a9a9",
    darkgreen = "#006400",
    darkkhaki = "#bdb76b",
    darkmagenta = "#8b008b",
    darkolivegreen = "#556b2f",
    darkorange = "#ff8c00",
    darkorchid = "#9932cc",
    darkred = "#8b0000",
    darksalmon = "#e9967a",
    darkseagreen = "#8fbc8f",
    darkslateblue = "#483d8b",
    darkslategray = "#2f4f4f",
    darkslategrey = "#2f4f4f",
    darkturquoise = "#00ced1",
    darkviolet = "#9400d3",
    deeppink = "#ff1493",
    deepskyblue = "#00bfff",
    dimgray = "#696969",
    dimgrey = "#696969",
    dodgerblue = "#1e90ff",
    firebrick = "#b22222",
    floralwhite = "#fffaf0",
    forestgreen = "#228b22",
    fuchsia = "#ff00ff",
    gainsboro = "#dcdcdc",
    ghostwhite = "#f8f8ff",
    gold = "#ffd700",
    goldenrod = "#daa520",
    gray = "#808080",
    grey = "#808080",
    green = "#008000",
    greenyellow = "#adff2f",
    honeydew = "#f0fff0",
    hotpink = "#ff69b4",
    indianred = "#cd5c5c",
    indigo = "#4b0082",
    ivory = "#fffff0",
    khaki = "#f0e68c",
    lavender = "#e6e6fa",
    lavenderblush = "#fff0f5",
    lawngreen = "#7cfc00",
    lemonchiffon = "#fffacd",
    lightblue = "#add8e6",
    lightcoral = "#f08080",
    lightcyan = "#e0ffff",
    lightgoldenrodyellow = "#fafad2",
    lightgreen = "#90ee90",
    lightgray = "#d3d3d3",
    lightgrey = "#d3d3d3",
    lightpink = "#ffb6c1",
    lightsalmon = "#ffa07a",
    lightseagreen = "#20b2aa",
    lightskyblue = "#87cefa",
    lightslategray = "#778899",
    lightslategrey = "#778899",
    lightsteelblue = "#b0c4de",
    lightyellow = "#ffffe0",
    lime = "#00ff00",
    limegreen = "#32cd32",
    linen = "#faf0e6",
    magenta = "#ff00ff",
    maroon = "#800000",
    mediumaquamarine = "#66cdaa",
    mediumblue = "#0000cd",
    mediumorchid = "#ba55d3",
    mediumpurple = "#9370db",
    mediumseagreen = "#3cb371",
    mediumslateblue = "#7b68ee",
    mediumspringgreen = "#00fa9a",
    mediumturquoise = "#48d1cc",
    mediumvioletred = "#c71585",
    midnightblue = "#191970",
    mintcream = "#f5fffa",
    mistyrose = "#ffe4e1",
    moccasin = "#ffe4b5",
    navajowhite = "#ffdead",
    navy = "#000080",
    oldlace = "#fdf5e6",
    olive = "#808000",
    olivedrab = "#6b8e23",
    orange = "#ffa500",
    orangered = "#ff4500",
    orchid = "#da70d6",
    palegoldenrod = "#eee8aa",
    palegreen = "#98fb98",
    paleturquoise = "#afeeee",
    palevioletred = "#db7093",
    papayawhip = "#ffefd5",
    peachpuff = "#ffdab9",
    peru = "#cd853f",
    pink = "#ffc0cb",
    plum = "#dda0dd",
    powderblue = "#b0e0e6",
    purple = "#800080",
    rebeccapurple = "#663399",
    red = "#ff0000",
    rosybrown = "#bc8f8f",
    royalblue = "#4169e1",
    saddlebrown = "#8b4513",
    salmon = "#fa8072",
    sandybrown = "#f4a460",
    seagreen = "#2e8b57",
    seashell = "#fff5ee",
    sienna = "#a0522d",
    silver = "#c0c0c0",
    skyblue = "#87ceeb",
    slateblue = "#6a5acd",
    slategray = "#708090",
    slategrey = "#708090",
    snow = "#fffafa",
    springgreen = "#00ff7f",
    steelblue = "#4682b4",
    tan = "#d2b48c",
    teal = "#008080",
    thistle = "#d8bfd8",
    tomato = "#ff6347",
    turquoise = "#40e0d0",
    violet = "#ee82ee",
    wheat = "#f5deb3",
    white = "#ffffff",
    whitesmoke = "#f5f5f5",
    yellow = "#ffff00",
    yellowgreen = "#9acd32",

    transparent = "#0000",
}

