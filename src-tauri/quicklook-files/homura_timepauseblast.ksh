   homura_timepauseblast      SAMPLER    +         SCREEN_PARAMS                                HOMURA_TIMEPAUSEBLAST                                postprocess_base.vs�   attribute vec3 POSITION;
attribute vec2 TEXCOORD0;

varying vec2 PS_TEXCOORD0;

void main()
{
	gl_Position = vec4( POSITION.xyz, 1.0 );
	PS_TEXCOORD0.xy = TEXCOORD0.xy;
}    homura_timepauseblast.ps3  // HOMURA SHADER: 向外扩散的震荡波，内部为灰色。
// x: 外径 y: nil z: 屏幕长宽比 w: 灰度系数
// x,y: 圆心  z: 外径  w: 灰度系数

#if defined( GL_ES )
precision highp float;
#endif

uniform sampler2D SAMPLER[1];

#define SRC_IMAGE SAMPLER[0]

uniform vec4 SCREEN_PARAMS;

#define W_H  (SCREEN_PARAMS.x / SCREEN_PARAMS.y)

uniform vec4 HOMURA_TIMEPAUSEBLAST;

#define P            HOMURA_TIMEPAUSEBLAST 
#define X 	         P.x 
#define Y            P.y 
#define OUTER_RADIUS P.z
#define WAVE_WIDTH 	 0.1 // 波宽（常量）
#define INNER_RADIUS (OUTER_RADIUS - WAVE_WIDTH)
#define GREY		 P.w

varying vec2 PS_TEXCOORD0;

#define V1 vec3(.33,.33,.33)
#define V2 vec3(1.0,1.0,1.0)

#define APPLYGREY(color, percent) mix(color, vec4(dot(V1, color.rgb)*V2, 1.0), percent*GREY)

void main(void)
{	
	vec2 offset_vec = vec2(PS_TEXCOORD0.x - X, (PS_TEXCOORD0.y  - Y) / W_H);
	float len = length(offset_vec);
	vec4 origincolor = texture2D(SRC_IMAGE, PS_TEXCOORD0);
	if (len < INNER_RADIUS)
		gl_FragColor.xyz = APPLYGREY(origincolor, 1.0).xyz;
	else if (len < OUTER_RADIUS)
		gl_FragColor.xyz = texture2D(SRC_IMAGE, PS_TEXCOORD0 - normalize(offset_vec) * len * clamp((len-INNER_RADIUS)/WAVE_WIDTH, 0.0, 1.0) * 0.25).xyz;
	else
		gl_FragColor = origincolor;
}
                  