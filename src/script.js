import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as THREE from 'three';
import { GUI } from 'dat.gui';
let scene, camera, renderer, gui;
let sphere1, sphere2, reactionSphere;
let particleSystem, particleGeometry, particleMaterial;
let lineSystem, lineGeometry, lineMaterial;
let reactionMaterial;
let clock = new THREE.Clock();

// Animation state
let animationState = 'approaching'; // 'approaching', 'colliding', 'particles'
let collisionTime = 0;
let particlesStartTime = 0;
let hasCollided = false;

// Particle system properties
const particleCount = 600; // Increased for denser liquid-like effect
const lineCount = 20; // Reduced for subtler glowing trails
let particles = [];
let lines = [];

// Animation parameters
const params = {
    sphere1Speed: 1.0,
    sphere2Speed: 1.0,
    reactionIntensity: 1.0,
    reactionColor1: '#ff6b35',
    reactionColor2: '#4ecdc4',
    glowIntensity: 2.0,
    animationSpeed: 1.0,
    collisionDistance: 2.2,
    particleSpeed: 1.2, // Slower for liquid-like flow
    particleSize: 0.12, // Larger for glowing liquid effect
    lineOpacity: 0.3, // Subtle glowing trails
    particleLifetime: 12.0, // Longer for sustained reaction
    explosionForce: 2.5, // Gentler for liquid-like motion
    sphereRadius: 3.0,
    reactionSphereColor: '#88ff88',
    emissiveColor: '#00ff00',
    emissiveIntensity: 0.5,
    metalness: 0.0,
    roughness: 0.05,
    opacity: 0.4,
    transmission: 0.95,
    reflectivity: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    particleColor: '#00ff00',
    resetAnimation: function() {
        resetAnimation();
    }
};

// Function to load shader files
async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

async function init() {
    // Load shaders
    const vertexShader = await loadShader('src/shaders/vertexShader.glsl');
    const fragmentShader = await loadShader('src/shaders/fragmentShader.glsl');

    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000011);
    document.body.appendChild(renderer.domElement);

    // Load HDRI for environment
    const loader = new THREE.RGBELoader();
    loader.load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/pretoria_gardens_1k.hdr', function(texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        // scene.background = texture; // Uncomment to set HDRI as background
    });

    // Create sphere material for original spheres
    reactionMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_time: { value: 0.0 },
            u_reactionIntensity: { value: params.reactionIntensity },
            u_color1: { value: new THREE.Color(params.reactionColor1) },
            u_color2: { value: new THREE.Color(params.reactionColor2) },
            u_glowIntensity: { value: params.glowIntensity },
            u_morphFactor: { value: 0.0 },
            u_collisionIntensity: { value: 0.0 },
            u_scale: { value: 1.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.DoubleSide
    });

    // Create glass-like material with neon green glow
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(params.reactionSphereColor),
        emissive: new THREE.Color(params.emissiveColor),
        emissiveIntensity: params.emissiveIntensity,
        metalness: params.metalness,
        roughness: params.roughness,
        opacity: params.opacity,
        transparent: true,
        transmission: params.transmission,
        reflectivity: params.reflectivity,
        clearcoat: params.clearcoat,
        clearcoatRoughness: params.clearcoatRoughness,
        side: THREE.DoubleSide
    });

    createSpheres();
    createReactionSphere(glassMaterial);
    createParticleSystem();
    createLineSystem();
    
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00ff00, 1.0, 50);
    pointLight.position.set(0, 5, 5);
    scene.add(pointLight);

    setupGUI();
    animate();
}

function createSpheres() {
    const sphereGeometry = new THREE.SphereGeometry(1, 64, 32);
    
    sphere1 = new THREE.Mesh(sphereGeometry, reactionMaterial.clone());
    sphere1.position.set(-6, 0, 0);
    scene.add(sphere1);

    sphere2 = new THREE.Mesh(sphereGeometry, reactionMaterial.clone());
    sphere2.position.set(6, 0, 0);
    scene.add(sphere2);
}

function createReactionSphere(material) {
    const sphereGeometry = new THREE.SphereGeometry(params.sphereRadius, 64, 32);
    reactionSphere = new THREE.Mesh(sphereGeometry, material);
    reactionSphere.visible = false;
    scene.add(reactionSphere);
}

function createParticleSystem() {
    particleGeometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    updateParticleColors(); // Initial color setup
    
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        
        sizes[i] = Math.random() * params.particleSize + params.particleSize * 0.5;
        
        particles.push({
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * params.explosionForce,
                (Math.random() - 0.5) * params.explosionForce,
                (Math.random() - 0.5) * params.explosionForce
            ),
            life: 0,
            maxLife: Math.random() * params.particleLifetime + params.particleLifetime * 0.5,
            originalSize: sizes[i]
        });
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_time: { value: 0.0 }
        },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            
            void main() {
                float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
                float alpha = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
                gl_FragColor = vec4(vColor, alpha * 0.7);
            }
        `,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending
    });
    
    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.visible = false;
    scene.add(particleSystem);
}

function updateParticleColors() {
    const colors = particleGeometry.attributes.color.array;
    for (let i = 0; i < particleCount; i++) {
        const hue = 0.33 + (Math.random() - 0.5) * 0.05;
        const color = new THREE.Color(params.particleColor).setHSL(hue, 1.0, 0.5 + Math.random() * 0.2);
        const idx = i * 3;
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;
    }
    particleGeometry.attributes.color.needsUpdate = true;
}

function createLineSystem() {
    lineGeometry = new THREE.BufferGeometry();
    
    const linePositions = new Float32Array(lineCount * 6);
    const lineColors = new Float32Array(lineCount * 6);
    
    for (let i = 0; i < lineCount; i++) {
        const idx = i * 6;
        linePositions[idx] = 0;     linePositions[idx + 1] = 0;     linePositions[idx + 2] = 0;
        linePositions[idx + 3] = 0; linePositions[idx + 4] = 0;     linePositions[idx + 5] = 0;
        
        const hue = 0.33 + (Math.random() - 0.5) * 0.05;
        const color = new THREE.Color().setHSL(hue, 1.0, 0.6);
        
        lineColors[idx] = color.r;     lineColors[idx + 1] = color.g;     lineColors[idx + 2] = color.b;
        lineColors[idx + 3] = color.r; lineColors[idx + 4] = color.g;     lineColors[idx + 5] = color.b;
        
        const endPos = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(params.sphereRadius * (0.5 + Math.random() * 0.5));
        
        lines.push({
            startPos: new THREE.Vector3(0, 0, 0),
            endPos: endPos,
            life: 0,
            maxLife: Math.random() * 4 + 3,
            color: color
        });
    }
    
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    
    lineMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: params.lineOpacity,
        blending: THREE.AdditiveBlending
    });
    
    lineSystem = new THREE.LineSegments(lineGeometry, lineMaterial);
    lineSystem.visible = false;
    scene.add(lineSystem);
}

function setupGUI() {
    gui = new dat.GUI();
    
    gui.add(params, 'sphere1Speed', 0.1, 3.0).name('Sphere 1 Speed');
    gui.add(params, 'sphere2Speed', 0.1, 3.0).name('Sphere 2 Speed');
    gui.add(params, 'reactionIntensity', 0.0, 3.0).name('Reaction Intensity').onChange(updateUniforms);
    gui.addColor(params, 'reactionColor1').name('Color 1').onChange(updateUniforms);
    gui.addColor(params, 'reactionColor2').name('Color 2').onChange(updateUniforms);
    gui.add(params, 'glowIntensity', 0.0, 5.0).name('Glow Intensity').onChange(updateUniforms);
    gui.add(params, 'animationSpeed', 0.1, 3.0).name('Animation Speed');
    gui.add(params, 'collisionDistance', 1.5, 4.0).name('Collision Distance');
    gui.add(params, 'particleSpeed', 1.0, 5.0).name('Particle Speed');
    gui.add(params, 'particleSize', 0.02, 0.2).name('Particle Size').onChange(updateParticleSizes);
    gui.add(params, 'lineOpacity', 0.1, 1.0).name('Line Opacity').onChange(() => {
        lineMaterial.opacity = params.lineOpacity;
    });
    gui.add(params, 'explosionForce', 2.0, 10.0).name('Explosion Force');
    gui.add(params, 'particleLifetime', 3.0, 12.0).name('Particle Lifetime');

    // Add controls for reaction sphere material
    const sphereFolder = gui.addFolder('Reaction Sphere Material');
    sphereFolder.add(params, 'sphereRadius', 1.0, 5.0).name('Sphere Radius').onChange(updateMaterial);
    sphereFolder.addColor(params, 'reactionSphereColor').name('Color').onChange(updateMaterial);
    sphereFolder.addColor(params, 'emissiveColor').name('Emissive Color').onChange(updateMaterial);
    sphereFolder.add(params, 'emissiveIntensity', 0.0, 1.0).name('Emissive Intensity').onChange(updateMaterial);
    sphereFolder.add(params, 'metalness', 0.0, 1.0).name('Metalness').onChange(updateMaterial);
    sphereFolder.add(params, 'roughness', 0.0, 1.0).name('Roughness').onChange(updateMaterial);
    sphereFolder.add(params, 'opacity', 0.0, 1.0).name('Opacity').onChange(updateMaterial);
    sphereFolder.add(params, 'transmission', 0.0, 1.0).name('Transmission').onChange(updateMaterial);
    sphereFolder.add(params, 'reflectivity', 0.0, 1.0).name('Reflectivity').onChange(updateMaterial);
    sphereFolder.add(params, 'clearcoat', 0.0, 1.0).name('Clearcoat').onChange(updateMaterial);
    sphereFolder.add(params, 'clearcoatRoughness', 0.0, 1.0).name('Clearcoat Roughness').onChange(updateMaterial);

    // Add control for liquid glow (particle color)
    const liquidFolder = gui.addFolder('Liquid Glow');
    liquidFolder.addColor(params, 'particleColor').name('Particle Color').onChange(updateParticleColors);

    gui.add(params, 'resetAnimation').name('Reset Animation');
}

function updateParticleSizes() {
    const sizes = particleGeometry.attributes.size.array;
    for (let i = 0; i < particleCount; i++) {
        sizes[i] = Math.random() * params.particleSize + params.particleSize * 0.5;
        particles[i].originalSize = sizes[i];
    }
    particleGeometry.attributes.size.needsUpdate = true;
}

function updateMaterial() {
    reactionSphere.geometry = new THREE.SphereGeometry(params.sphereRadius, 64, 32);
    reactionSphere.material.color.set(params.reactionSphereColor);
    reactionSphere.material.emissive.set(params.emissiveColor);
    reactionSphere.material.emissiveIntensity = params.emissiveIntensity;
    reactionSphere.material.metalness = params.metalness;
    reactionSphere.material.roughness = params.roughness;
    reactionSphere.material.opacity = params.opacity;
    reactionSphere.material.transmission = params.transmission;
    reactionSphere.material.reflectivity = params.reflectivity;
    reactionSphere.material.clearcoat = params.clearcoat;
    reactionSphere.material.clearcoatRoughness = params.clearcoatRoughness;
    reactionSphere.material.needsUpdate = true;
}

function updateUniforms() {
    const materials = [sphere1.material, sphere2.material];
    materials.forEach(material => {
        material.uniforms.u_reactionIntensity.value = params.reactionIntensity;
        material.uniforms.u_color1.value.setHex(params.reactionColor1.replace('#', '0x'));
        material.uniforms.u_color2.value.setHex(params.reactionColor2.replace('#', '0x'));
        material.uniforms.u_glowIntensity.value = params.glowIntensity;
    });
}

function resetAnimation() {
    animationState = 'approaching';
    hasCollided = false;
    collisionTime = 0;
    particlesStartTime = 0;
    
    sphere1.position.set(-6, 0, 0);
    sphere2.position.set(6, 0, 0);
    sphere1.visible = true;
    sphere2.visible = true;
    reactionSphere.visible = false;
    particleSystem.visible = false;
    lineSystem.visible = false;
    
    // Reset uniforms
    [sphere1.material, sphere2.material].forEach(material => {
        material.uniforms.u_morphFactor.value = 0.0;
        material.uniforms.u_collisionIntensity.value = 0.0;
        material.uniforms.u_scale.value = 1.0;
    });
    
    // Reset particles
    for (let i = 0; i < particles.length; i++) {
        particles[i].life = 0;
        particles[i].velocity.set(
            (Math.random() - 0.5) * params.explosionForce,
            (Math.random() - 0.5) * params.explosionForce,
            (Math.random() - 0.5) * params.explosionForce
        );
    }
    
    // Reset lines
    for (let i = 0; i < lines.length; i++) {
        lines[i].life = 0;
        lines[i].endPos = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(params.sphereRadius * (0.5 + Math.random() * 0.5));
    }
}

function updateParticles(deltaTime) {
    const positions = particleGeometry.attributes.position.array;
    const colors = particleGeometry.attributes.color.array;
    const sizes = particleGeometry.attributes.size.array;
    
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        particle.life += deltaTime;
        
        if (particle.life < particle.maxLife) {
            // Update position
            const idx = i * 3;
            positions[idx] += particle.velocity.x * deltaTime * params.particleSpeed;
            positions[idx + 1] += particle.velocity.y * deltaTime * params.particleSpeed;
            positions[idx + 2] += particle.velocity.z * deltaTime * params.particleSpeed;
            
            // Add turbulent motion for liquid-like effect
            const time = particle.life;
            particle.velocity.x += Math.sin(time * 2.5 + i) * 0.15 * deltaTime;
            particle.velocity.y += Math.cos(time * 2.0 + i) * 0.15 * deltaTime;
            particle.velocity.z += Math.sin(time * 2.2 + i) * 0.15 * deltaTime;
            
            // Apply damping
            particle.velocity.multiplyScalar(0.93);
            
            // Constrain particles within spherical boundary
            const pos = new THREE.Vector3(positions[idx], positions[idx + 1], positions[idx + 2]);
            const distance = pos.length();
            if (distance > params.sphereRadius * 0.95) {
                pos.normalize().multiplyScalar(params.sphereRadius * 0.95);
                positions[idx] = pos.x;
                positions[idx + 1] = pos.y;
                positions[idx + 2] = pos.z;
                
                const normal = pos.clone().normalize();
                const velocity = particle.velocity;
                const dot = velocity.dot(normal);
                particle.velocity.sub(normal.multiplyScalar(2 * dot));
                particle.velocity.multiplyScalar(0.7);
            }
            
            // Update size and color
            const lifeRatio = particle.life / particle.maxLife;
            sizes[i] = particle.originalSize * (1.0 - lifeRatio * 0.5);
            
            const colorMultiplier = 1.0 - lifeRatio * 0.4;
            colors[idx] *= colorMultiplier;
            colors[idx + 1] *= colorMultiplier;
            colors[idx + 2] *= colorMultiplier;
        }
    }
    
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    particleGeometry.attributes.size.needsUpdate = true;
}

function updateLines(deltaTime) {
    const positions = lineGeometry.attributes.position.array;
    const colors = lineGeometry.attributes.color.array;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        line.life += deltaTime;
        
        if (line.life < line.maxLife) {
            const lifeRatio = line.life / line.maxLife;
            const idx = i * 6;
            
            // Animate line growth within spherical boundary
            const currentEnd = line.startPos.clone().lerp(line.endPos, lifeRatio);
            const distance = currentEnd.length();
            if (distance > params.sphereRadius * 0.95) {
                currentEnd.normalize().multiplyScalar(params.sphereRadius * 0.95);
            }
            positions[idx + 3] = currentEnd.x;
            positions[idx + 4] = currentEnd.y;
            positions[idx + 5] = currentEnd.z;
            
            // Fade color
            const alpha = 1.0 - lifeRatio * 0.7;
            colors[idx] = line.color.r * alpha;
            colors[idx + 1] = line.color.g * alpha;
            colors[idx + 2] = line.color.b * alpha;
            colors[idx + 3] = line.color.r * alpha;
            colors[idx + 4] = line.color.g * alpha;
            colors[idx + 5] = line.color.b * alpha;
        }
    }
    
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.color.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta() * params.animationSpeed;
    const elapsedTime = clock.getElapsedTime() * params.animationSpeed;
    const distance = sphere1.position.distanceTo(sphere2.position);
    
    // State machine
    switch(animationState) {
        case 'approaching':
            // Move spheres towards each other
            sphere1.position.x += params.sphere1Speed * 0.02;
            sphere2.position.x -= params.sphere2Speed * 0.02;
            
            // Add oscillation
            sphere1.position.y = Math.sin(elapsedTime * 2) * 0.3;
            sphere2.position.y = Math.cos(elapsedTime * 1.8) * 0.3;
            
            // Check for collision
            if (distance <= params.collisionDistance && !hasCollided) {
                animationState = 'colliding';
                collisionTime = elapsedTime;
                hasCollided = true;
            }
            break;
            
        case 'colliding':
            // Collision effects
            const collisionDuration = elapsedTime - collisionTime;
            const collisionIntensity = Math.min(collisionDuration * 2, 1.0);
            
            sphere1.material.uniforms.u_collisionIntensity.value = collisionIntensity;
            sphere2.material.uniforms.u_collisionIntensity.value = collisionIntensity;
            sphere1.material.uniforms.u_morphFactor.value = collisionIntensity;
            sphere2.material.uniforms.u_morphFactor.value = collisionIntensity;
            
            // Start particle system and reaction sphere after 1.5 seconds
            if (collisionDuration > 1.5) {
                animationState = 'particles';
                particlesStartTime = elapsedTime;
                sphere1.visible = false;
                sphere2.visible = false;
                reactionSphere.visible = true;
                particleSystem.visible = true;
                lineSystem.visible = true;
                
                // Position systems at collision center
                const collisionCenter = sphere1.position.clone().add(sphere2.position).multiplyScalar(0.5);
                reactionSphere.position.copy(collisionCenter);
                particleSystem.position.copy(collisionCenter);
                lineSystem.position.copy(collisionCenter);
            }
            break;
            
        case 'particles':
            // Update particle and line systems
            updateParticles(deltaTime);
            updateLines(deltaTime);
            break;
    }
    
    // Update common uniforms
    [sphere1.material, sphere2.material].forEach(material => {
        material.uniforms.u_time.value = elapsedTime;
    });
    
    particleMaterial.uniforms.u_time.value = elapsedTime;
    
    // Rotate spheres
    if (sphere1.visible) {
        sphere1.rotation.y = elapsedTime * 0.5;
        sphere1.rotation.x = elapsedTime * 0.3;
    }
    if (sphere2.visible) {
        sphere2.rotation.y = -elapsedTime * 0.4;
        sphere2.rotation.x = elapsedTime * 0.6;
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize the scene
init();