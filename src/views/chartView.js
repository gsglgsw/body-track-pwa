// src/views/chartView.js

export default class ChartView {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chartInstance = null;
    
    if (!this.canvas) {
      console.error(`[ChartView] 找不到指定的 Canvas ID: ${canvasId}`);
    }
  }

  // 🚩 擴充參數接收 goalBodyFat
  renderChart(labels, weightData, bodyFatData, goalWeight = null, goalBodyFat = null) {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = this.canvas.getContext('2d');

    // --- 🚩 動態生成目標線 Annotations ---
    const annotations = {};
    
    // 體重目標線 (綁定左側 y 軸)
    if (goalWeight) {
      annotations.goalWeightLine = {
        type: 'line',
        yMin: goalWeight,
        yMax: goalWeight,
        yScaleID: 'y', // 綁定左側軸
        borderColor: '#e5989b', // 粉色
        borderWidth: 1, // 虛線改細
        borderDash: [4, 4],
        label: {
          display: true,
          content: `目標 ${goalWeight}kg`,
          position: 'start',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          color: '#e5989b', // 粉色文字
          font: { weight: 'normal', size: 10 },
          yAdjust: -10
        }
      };
    }
    
    // 體脂目標線 (綁定右側 y1 軸)
    if (goalBodyFat) {
      annotations.goalBodyFatLine = {
        type: 'line',
        yMin: goalBodyFat,
        yMax: goalBodyFat,
        yScaleID: 'y1', // 綁定右側軸
        borderColor: '#a3b18a', // 綠色
        borderWidth: 1, // 虛線改細
        borderDash: [4, 4],
        label: {
          display: true,
          content: `目標 ${goalBodyFat}%`,
          position: 'end', // 靠右顯示
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          color: '#a3b18a', // 綠色文字
          font: { weight: 'normal', size: 10 },
          yAdjust: -10
        }
      };
    }

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '體重 (kg)',
            data: weightData,
            borderColor: '#e5989b', // 玫瑰粉
            backgroundColor: '#e5989b',
            yAxisID: 'y',
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: '體脂率 (%)',
            data: bodyFatData,
            borderColor: '#a3b18a', // 鼠尾草綠
            backgroundColor: '#a3b18a',
            yAxisID: 'y1',
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#57534e', font: { size: 12 }, usePointStyle: true, padding: 20 }
          },
          // 啟用我們剛剛組合好的目標線
          annotation: { annotations: annotations }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#a8a29e', font: { size: 10 } }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            // 🚩 將左側格線與字體改為粉色系，呼應體重數據
            grid: { color: 'rgba(229, 152, 155, 0.15)' },
            ticks: { color: '#e5989b', font: { size: 11, weight: 'bold' } },
            border: { display: true, color: '#e5989b' } // 左側邊線改為粉色
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            // 🚩 將右側字體改為綠色系，呼應體脂數據
            ticks: { color: '#a3b18a', font: { size: 11, weight: 'bold' } },
            border: { display: true, color: '#a3b18a' } // 右側邊線改為綠色
          }
        }
      }
    });
  }
}