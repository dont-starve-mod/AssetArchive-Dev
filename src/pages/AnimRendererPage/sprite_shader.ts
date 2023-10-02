export const tint =
`precision highp float;

varying vec2 vTextureCoord;
varying vec4 vColor;

uniform sampler2D uSampler;
uniform vec4 mult;
uniform vec4 add;

void main(void)
{
  vec4 colour = texture2D( uSampler, vTextureCoord.xy );
  colour = vec4(
    colour.r * mult.r + add.r * add.a,
    colour.g * mult.g + add.g * add.a,
    colour.b * mult.b + add.b * add.a,
    colour.a * mult.a
   );
   gl_FragColor = vec4(colour.rgb * colour.a, colour.a );
}`
