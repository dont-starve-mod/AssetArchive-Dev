// modified from data/shaders/postprocess_colourcube.ksh

const source: string =
`precision highp float;

varying vec2 vTextureCoord;
varying vec4 vColor;

uniform sampler2D uSampler;
uniform sampler2D uCCTexture;
uniform float percent;

const float CUBE_DIMENSION = 32.0;
const float CUBE_WIDTH = ( CUBE_DIMENSION * CUBE_DIMENSION );
const float CUBE_HEIGHT =( CUBE_DIMENSION );
const float ONE_OVER_CUBE_WIDTH =  1.0 / CUBE_WIDTH;
const float ONE_OVER_CUBE_HEIGHT =  1.0 / CUBE_HEIGHT;

vec3 ApplyColourCube(vec3 colour)
{
	vec3 intermediate = colour.rgb * vec3( CUBE_DIMENSION - 1.0, CUBE_DIMENSION - 1.0, CUBE_DIMENSION - 1.0 );
	vec2 floor_uv = vec2( ( min( intermediate.r + 0.5, 31.0 ) + floor( intermediate.b ) * CUBE_DIMENSION ) * ONE_OVER_CUBE_WIDTH, ( min( intermediate.g + 0.5, 31.0 ) * ONE_OVER_CUBE_HEIGHT ) );
	vec2 ceil_uv = vec2( ( min( intermediate.r + 0.5, 31.0 ) + ceil( intermediate.b ) * CUBE_DIMENSION ) * ONE_OVER_CUBE_WIDTH, ( min( intermediate.g + 0.5, 31.0 ) * ONE_OVER_CUBE_HEIGHT ) );
	vec3 floor_col = texture2D( uCCTexture, floor_uv ).rgb;
	vec3 ceil_col = texture2D( uCCTexture, ceil_uv ).rgb;
	return mix(floor_col, ceil_col, intermediate.b - floor(intermediate.b) );	
}

void main(void)
{
   vec4 colour = texture2D( uSampler, vTextureCoord.xy );
   gl_FragColor = vec4(mix(colour.rgb, ApplyColourCube(colour.rgb), percent), colour.a );
}`

export default source