// src/views/chartView.js

export default class ChartView {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chartInstance = null;
    
    if (!this.canvas) {
      console.error(`[ChartView] 找不到指定的 Canvas ID: ${canvasId}`);
    }
  }

  renderChart(labels, data, isPeriodData = [], goalValue = null, metricType = 'weight') {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = this.canvas.getContext('2d');

    const themes = {
      weight: { color: '#f43f5e', label: '體重 (kg)' },
      bodyFat: { color: '#10b981', label: '體脂率 (%)' },
      waist: { color: '#f59e0b', label: '腰圍 (cm)' }
    };
    const currentTheme = themes[metricType] || themes.weight;

    const pointColors = data.map((_, index) => isPeriodData[index] ? '#f43f5e' : '#fff');
    const pointBorderColors = data.map((_, index) => isPeriodData[index] ? '#f43f5e' : currentTheme.color);

    // 🚩 核心邏輯：計算當前數據的平均值 (排除空值)
    const validData = data.filter(val => val !== null && !isNaN(val));
    const averageValue = validData.length > 0 
        ? (validData.reduce((a, b) => a + b, 0) / validData.length).toFixed(1) 
        : null;

    const annotations = {};
    
    // 1. 繪製目標線 (細虛線)
    if (goalValue) {
      annotations.goalLine = {
        type: 'line', yMin: goalValue, yMax: goalValue, yScaleID: 'y',
        borderColor: currentTheme.color, borderWidth: 1.5, borderDash: [3, 3], // 虛線
        label: { 
            display: true, content: `目標 ${goalValue}`, position: 'start', 
            backgroundColor: 'rgba(255, 255, 255, 0.9)', color: currentTheme.color, 
            font: { weight: 'bold', size: 10 }, yAdjust: -12 
        }
      };
    }

    // 🚩 2. 繪製平均直線 (實線，帶有底色標籤)
    if (averageValue !== null) {
      annotations.averageLine = {
        type: 'line', yMin: averageValue, yMax: averageValue, yScaleID: 'y',
        borderColor: currentTheme.color, borderWidth: 1, // 實線
        backgroundColor: 'rgba(255,255,255,0.5)',
        label: {
            display: true, content: `平均 ${averageValue}`, position: 'end',
            backgroundColor: currentTheme.color, color: '#fff', // 反白凸顯平均值
            font: { weight: 'bold', size: 10 }, yAdjust: 12 // 往下偏移，避免跟目標線撞在一起
        }
      };
    }

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
            label: currentTheme.label,
            data: data,
            borderColor: currentTheme.color,
            backgroundColor: currentTheme.color,
            yAxisID: 'y',
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: pointColors,       
            pointBorderColor: pointBorderColors,     
            pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          annotation: { annotations: annotations } // 掛載目標與平均線
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#a8a29e', font: { size: 10 } } },
          y: { 
              type: 'linear', display: true, position: 'left', 
              grid: { color: 'rgba(0, 0, 0, 0.05)' }, 
              ticks: { color: currentTheme.color, font: { size: 11, weight: 'bold' } }, 
              border: { display: true, color: currentTheme.color } 
          }
        }
      }
    });
  }
}