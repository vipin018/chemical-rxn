uniform float u_time;
uniform float u_reactionIntensity;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_glowIntensity;
uniform float u_collisionIntensity;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

// Utility functions
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Wave functions for interior patterns
float wavePattern1(vec3 pos, float u_time) {
    return sin(pos.x * 3.0 + u_time * 2.0) * 
           sin(pos.y * 2.5 + u_time * 1.8) * 
           sin(pos.z * 4.0 + u_time * 2.3);
}

float wavePattern2(vec3 pos, float u_time) {
    return cos(length(pos.xy) * 6.0 - u_time * 3.0) * 
           sin(pos.z * 8.0 + u_time * 2.5);
}

float spiralWave(vec3 pos, float u_time) {
    float r = length(pos.xy);
    float angle = atan(pos.y, pos.x);
    return sin(r * 10.0 + angle * 4.0 - u_time * 5.0) * 
           cos(pos.z * 8.0 + u_time * 3.0);
}

void main() {
    vec3 worldPos = vPosition;
    float distanceToCenter = length(worldPos);
    
    // Create wave layers
    float wave1 = wavePattern1(worldPos * 0.8, u_time) * 0.5 + 0.5;
    float wave2 = wavePattern2(worldPos * 1.2, u_time + 1.0) * 0.5 + 0.5;
    float spiralW = spiralWave(worldPos, u_time) * 0.5 + 0.5;
    
    // Create vibrant colors for waves
    vec3 waveColor1 = hsv2rgb(vec3(wave1 * 0.3 + u_time * 0.1, 0.9, 0.8));
    vec3 waveColor2 = hsv2rgb(vec3(wave2 * 0.4 + u_time * 0.08 + 0.3, 0.8, 0.9));
    vec3 spiralColor = hsv2rgb(vec3(spiralW * 0.6 + u_time * 0.12, 0.95, 0.9));
    
    // Base sphere color
    vec3 baseColor = mix(u_color1, u_color2, sin(u_time + distanceToCenter * 2.0) * 0.5 + 0.5);
    vec3 sphereColor = baseColor * 0.4;
    
    // Interior waves
    vec3 interiorWaves = vec3(0.0);
    float depthFactor = 1.0 - smoothstep(0.0, 1.2, distanceToCenter);
    
    interiorWaves += waveColor1 * smoothstep(0.3, 0.8, wave1) * 0.6;
    interiorWaves += waveColor2 * smoothstep(0.4, 0.9, wave2) * 0.5;
    interiorWaves += spiralColor * smoothstep(0.5, 1.0, spiralW) * 0.4;
    interiorWaves *= depthFactor * 1.5;
    
    // Enhanced collision effects
    if (u_collisionIntensity > 0.0) {
        float explosiveWave = sin(distanceToCenter * 20.0 - u_time * 12.0) * 
                             cos(length(worldPos.xy) * 15.0 - u_time * 10.0);
        explosiveWave = explosiveWave * 0.5 + 0.5;
        
        vec3 explosiveColor = hsv2rgb(vec3(explosiveWave * 0.2 + u_time * 0.2, 1.0, 1.0));
        interiorWaves += explosiveColor * smoothstep(0.6, 1.0, explosiveWave) * 
                        u_collisionIntensity * 2.0;
    }
    
    // Combine colors
    vec3 finalColor = sphereColor + interiorWaves;
    
    // Fresnel rim lighting
    vec3 viewDirection = normalize(cameraPosition - worldPos);
    float fresnel = 1.0 - abs(dot(vNormal, viewDirection));
    fresnel = pow(fresnel, 2.0);
    
    vec3 rimColor = mix(u_color1, u_color2, 0.5);
    finalColor += fresnel * rimColor * u_glowIntensity * 0.5;
    
    // Apply reaction intensity
    finalColor *= u_reactionIntensity;
    finalColor = pow(finalColor, vec3(0.9));
    
    gl_FragColor = vec4(finalColor, 1.0);
}