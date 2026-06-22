import { useRef, useEffect } from 'react';
import { useLoanStore } from '@/stores/loanStore';
import { formatMoney } from '@/utils/calculator';

export default function Charts() {
  const { schedule } = useLoanStore();
  const pieRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (schedule.length === 0) return;
    drawPieChart();
    drawBarChart();
    drawAreaChart();
  }, [schedule]);

  function drawPieChart() {
    const canvas = pieRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.height = h + 'px';

    const totalPrincipal = schedule.reduce((s, i) => s + i.principal, 0);
    const totalInterest = schedule.reduce((s, i) => s + i.interest, 0);
    const total = totalPrincipal + totalInterest;

    const cx = w / 2;
    const cy = h / 2 + 5;
    const radius = Math.min(cx, cy) - 20;

    // 本金
    const principalAngle = (totalPrincipal / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + principalAngle);
    ctx.closePath();
    ctx.fillStyle = '#4ecca3';
    ctx.fill();

    // 利息
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, -Math.PI / 2 + principalAngle, -Math.PI / 2 + Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#f0a500';
    ctx.fill();

    // 中心文字
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2b04a';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('本息占比', cx, cy - 8);
    ctx.fillStyle = '#4ecca3';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(`${Math.round((totalPrincipal / total) * 100)}%`, cx, cy + 16);

    // 图例
    const legendY = h - 15;
    ctx.fillStyle = '#4ecca3';
    ctx.fillRect(cx - 60, legendY - 6, 10, 10);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`本金 ¥${formatMoney(totalPrincipal)}`, cx - 46, legendY + 3);

    ctx.fillStyle = '#f0a500';
    ctx.fillRect(cx + 10, legendY - 6, 10, 10);
    ctx.fillStyle = '#aaa';
    ctx.fillText(`利息 ¥${formatMoney(totalInterest)}`, cx + 24, legendY + 3);
  }

  function drawBarChart() {
    const canvas = barRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.height = h + 'px';

    // 取最近12期或全部
    const data = schedule.slice(-12);
    const pad = { top: 15, right: 15, bottom: 30, left: 55 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const maxVal = Math.max(...data.map((d) => d.monthlyPayment));
    const barWidth = Math.min(chartW / data.length * 0.6, 30);

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#666';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`¥${Math.round(maxVal * (1 - i / 4) / 1000)}k`, pad.left - 8, y + 4);
    }

    // 柱状图
    data.forEach((d, i) => {
      const x = pad.left + (chartW / (data.length - 1 || 1)) * i - barWidth / 2;
      const hBar = (d.monthlyPayment / maxVal) * chartH;
      const y = pad.top + chartH - hBar;

      const gradient = ctx.createLinearGradient(x, y, x, pad.top + chartH);
      gradient.addColorStop(0, d.paid ? '#4ecca3' : '#e2b04a');
      gradient.addColorStop(1, d.paid ? 'rgba(78,204,163,0.3)' : 'rgba(226,176,74,0.3)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, hBar, [4, 4, 0, 0]);
      ctx.fill();

      // 期数标签
      ctx.fillStyle = '#666';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${d.period}`, pad.left + (chartW / (data.length - 1 || 1)) * i, pad.top + chartH + 15);
    });
  }

  function drawAreaChart() {
    const canvas = areaRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.height = h + 'px';

    const pad = { top: 15, right: 15, bottom: 30, left: 55 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const maxVal = schedule[0]?.remainingPrincipal + schedule[0]?.principal || 1;

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#666';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`¥${Math.round(maxVal * (1 - i / 4) / 10000)}万`, pad.left - 8, y + 4);
    }

    // 面积图
    ctx.beginPath();
    schedule.forEach((d, i) => {
      const x = pad.left + (chartW / (schedule.length - 1 || 1)) * i;
      const y = pad.top + chartH - (d.remainingPrincipal / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const lastX = pad.left + chartW;
    ctx.lineTo(lastX, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    gradient.addColorStop(0, 'rgba(78,158,252,0.3)');
    gradient.addColorStop(1, 'rgba(78,158,252,0.02)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 线条
    ctx.beginPath();
    schedule.forEach((d, i) => {
      const x = pad.left + (chartW / (schedule.length - 1 || 1)) * i;
      const y = pad.top + chartH - (d.remainingPrincipal / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#4e9efc';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-2xl p-4 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)', border: '1px solid rgba(226,176,74,0.1)' }}>
        <h3 className="text-sm font-semibold text-gray-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>本金利息占比</h3>
        <canvas ref={pieRef} className="w-full" />
      </div>
      <div className="rounded-2xl p-4 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)', border: '1px solid rgba(226,176,74,0.1)' }}>
        <h3 className="text-sm font-semibold text-gray-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>月度还款趋势</h3>
        <canvas ref={barRef} className="w-full" />
      </div>
      <div className="rounded-2xl p-4 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)', border: '1px solid rgba(226,176,74,0.1)' }}>
        <h3 className="text-sm font-semibold text-gray-400 mb-2" style={{ fontFamily: 'Georgia, serif' }}>剩余本金曲线</h3>
        <canvas ref={areaRef} className="w-full" />
      </div>
    </div>
  );
}