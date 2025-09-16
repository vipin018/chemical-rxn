uniform float u_morphFactor;
uniform float u_scale;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vec3 morphedPosition = position;
    
    // Apply scaling during collision
    morphedPosition *= u_scale;
    
    // Morphing effect during collision
    if (u_morphFactor > 0.0) {
        float distanceInfluence = 1.0 - clamp(length(position), 0.0, 1.0);
        morphedPosition += normalize(position) * sin(u_morphFactor * 10.0) * 0.1 * distanceInfluence;
    }
    
    vPosition = morphedPosition;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(morphedPosition, 1.0);
}