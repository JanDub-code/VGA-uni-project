AFRAME.registerComponent('lk-corridor-ring', {
    schema: {
        color: { type: 'color', default: '#00aaff' },
    },

    init() {
        this.el.setAttribute('geometry', 'primitive: torus; radius: 8; radiusTubular: 0.035')
        this.el.setAttribute('material', `color: ${this.data.color}; opacity: 0.28; transparent: true`)
    },
})
