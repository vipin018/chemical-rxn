let scene, camera, renderer, gui;
let sphere1, sphere2;
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
const particleCount = 300;
const lineCount = 50;
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
    particleSpeed: 2.0,
    particleSize: 0.05,
    lineOpacity: 0.8,
    particleLifetime: 8.0,
    explosionForce: 5.0,
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

    // Create sphere material
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

    createSpheres();
    createParticleSystem();
    createLineSystem();
    
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.1);
    scene.add(ambientLight);

    setupGUI();
    animate();
}

function createSpheres() {
    const sphereGeometry = new THREE.SphereGeometry(2, 64, 32);
    
    sphere1 = new THREE.Mesh(sphereGeometry, reactionMaterial.clone());
    sphere1.position.set(-6, 0, 0);
    scene.add(sphere1);

    sphere2 = new THREE.Mesh(sphereGeometry, reactionMaterial.clone());
    sphere2.position.set(6, 0, 0);
    scene.add(sphere2);
}

function createParticleSystem() {
    particleGeometry = new THREE.BufferGeometry();
    
    // Initialize particle positions and properties
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
        // Start particles at collision center
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        
        // Random colors
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 0.8, 0.7);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        sizes[i] = Math.random() * params.particleSize + params.particleSize * 0.5;
        
        // Create particle data
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
                gl_FragColor = vec4(vColor, alpha);
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

function createLineSystem() {
    lineGeometry = new THREE.BufferGeometry();
    
    const linePositions = new Float32Array(lineCount * 6); // 2 points per line
    const lineColors = new Float32Array(lineCount * 6); // 2 colors per line
    
    for (let i = 0; i < lineCount; i++) {
        // Initialize lines at center
        const idx = i * 6;
        linePositions[idx] = 0;     linePositions[idx + 1] = 0;     linePositions[idx + 2] = 0;
        linePositions[idx + 3] = 0; linePositions[idx + 4] = 0;     linePositions[idx + 5] = 0;
        
        // Random line colors
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 0.9, 0.8);
        
        lineColors[idx] = color.r;     lineColors[idx + 1] = color.g;     lineColors[idx + 2] = color.b;
        lineColors[idx + 3] = color.r; lineColors[idx + 4] = color.g;     lineColors[idx + 5] = color.b;
        
        // Create line data
        lines.push({
            startPos: new THREE.Vector3(0, 0, 0),
            endPos: new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8
            ),
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
    gui.add(params, 'particleSize', 0.02, 0.2).name('Particle Size');
    gui.add(params, 'lineOpacity', 0.1, 1.0).name('Line Opacity').onChange(() => {
        lineMaterial.opacity = params.lineOpacity;
    });
    gui.add(params, 'explosionForce', 2.0, 10.0).name('Explosion Force');
    gui.add(params, 'particleLifetime', 3.0, 12.0).name('Particle Lifetime');
    gui.add(params, 'resetAnimation').name('Reset Animation');
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
    }
    
    // Reset lines
    for (let i = 0; i < lines.length; i++) {
        lines[i].life = 0;
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
            
            // Apply gravity and damping
            particle.velocity.y -= 2.0 * deltaTime;
            particle.velocity.multiplyScalar(0.98);
            
            // Update size and color based on life
            const lifeRatio = particle.life / particle.maxLife;
            sizes[i] = particle.originalSize * (1.0 - lifeRatio * 0.8);
            
            // Fade color
            const colorMultiplier = 1.0 - lifeRatio * 0.7;
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
            
            // Animate line growth
            const currentEnd = line.startPos.clone().lerp(line.endPos, lifeRatio);
            positions[idx + 3] = currentEnd.x;
            positions[idx + 4] = currentEnd.y;
            positions[idx + 5] = currentEnd.z;
            
            // Fade color
            const alpha = 1.0 - lifeRatio * 0.8;
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
            
            // Start particle system after 1.5 seconds
            if (collisionDuration > 1.5) {
                animationState = 'particles';
                particlesStartTime = elapsedTime;
                sphere1.visible = false;
                sphere2.visible = false;
                particleSystem.visible = true;
                lineSystem.visible = true;
                
                // Position particle system at collision center
                const collisionCenter = sphere1.position.clone().add(sphere2.position).multiplyScalar(0.5);
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