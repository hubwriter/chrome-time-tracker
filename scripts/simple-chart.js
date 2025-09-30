// Simple pie chart implementation without external dependencies
class SimplePieChart {
    constructor(canvas, data, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.data = data;
        this.options = {
            padding: 20,
            legendHeight: 100,
            colors: options.colors || this.generateColors(data.labels.length),
            ...options
        };
        
        this.draw();
    }

    generateColors(count) {
        const colors = [];
        const hueStep = 360 / count;
        
        for (let i = 0; i < count; i++) {
            const hue = (i * hueStep) % 360;
            const saturation = 60 + (i % 2) * 20;
            const lightness = 50 + (i % 3) * 10;
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
        
        return colors;
    }

    draw() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas size for high DPI
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        // Clear canvas
        this.ctx.clearRect(0, 0, rect.width, rect.height);
        
        if (!this.data.datasets[0].data.length) return;
        
        const centerX = rect.width / 2;
        const centerY = (rect.height - this.options.legendHeight) / 2;
        const radius = Math.min(centerX, centerY) - this.options.padding;
        
        // Calculate angles
        const total = this.data.datasets[0].data.reduce((sum, value) => sum + value, 0);
        let currentAngle = -Math.PI / 2; // Start at top
        
        // Draw pie slices
        this.data.datasets[0].data.forEach((value, index) => {
            const sliceAngle = (value / total) * 2 * Math.PI;
            
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            this.ctx.closePath();
            
            this.ctx.fillStyle = this.options.colors[index];
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            currentAngle += sliceAngle;
        });
        
        // Draw legend
        this.drawLegend(rect.width, rect.height);
    }

    drawLegend(width, height) {
        const legendY = height - this.options.legendHeight + 20;
        const itemWidth = 200;
        const itemHeight = 20;
        const itemsPerRow = Math.floor(width / itemWidth);
        
        this.ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        
        this.data.labels.forEach((label, index) => {
            const row = Math.floor(index / itemsPerRow);
            const col = index % itemsPerRow;
            
            const x = (width - itemsPerRow * itemWidth) / 2 + col * itemWidth;
            const y = legendY + row * itemHeight;
            
            // Draw color box
            this.ctx.fillStyle = this.options.colors[index];
            this.ctx.fillRect(x, y - 8, 12, 12);
            
            // Draw label
            this.ctx.fillStyle = '#2d3748';
            this.ctx.fillText(label, x + 18, y + 2);
        });
    }

    destroy() {
        // Simple cleanup for compatibility with Chart.js API
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Make it compatible with Chart.js API
window.Chart = function(ctx, config) {
    return new SimplePieChart(ctx.canvas, config.data, {
        colors: config.data.datasets[0].backgroundColor
    });
};