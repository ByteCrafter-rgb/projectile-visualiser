const $ = (id) => document.getElementById(id);

export function createUI({ onChange, onFire, onView }) {
  const inputs = {
    speed: $('speed'),
    angle: $('angle'),
    direction: $('direction'),
    multi: $('multi'),
  };
  const viewInputs = document.querySelectorAll('input[name="view"]');
  const state = {};

  function read() {
    state.speed = Number(inputs.speed.value);
    state.angle = Number(inputs.angle.value);
    state.direction = Number(inputs.direction.value);
    state.multi = inputs.multi.checked;
    state.view = [...viewInputs].find((v) => v.checked).value;

    $('speed-out').textContent = `${state.speed} m/s`;
    $('angle-out').textContent = `${state.angle}°`;
    $('direction-out').textContent = `${state.direction}°`;
    $('legend').hidden = !state.multi;

    for (const input of [inputs.speed, inputs.angle, inputs.direction]) {
      const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty('--fill', `${pct}%`);
    }
  }

  for (const input of Object.values(inputs)) {
    input.addEventListener('input', () => {
      read();
      onChange(state);
    });
  }
  for (const input of viewInputs) {
    input.addEventListener('change', () => {
      read();
      onView(state);
    });
  }
  $('fire').addEventListener('click', () => onFire(state));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      onFire(state);
    }
  });

  read();

  return {
    state,
    setView(view) {
      for (const input of viewInputs) input.checked = input.value === view;
      read();
      onView(state);
    },
    setStats({ range, apex, time }) {
      $('stat-range').textContent = `${range.toFixed(1)} m`;
      $('stat-height').textContent = `${apex.toFixed(1)} m`;
      $('stat-time').textContent = `${time.toFixed(2)} s`;
    },
    setLegend(rows) {
      $('legend-list').replaceChildren(
        ...rows.map(({ angle, color, note, range }) => {
          const li = document.createElement('li');
          li.innerHTML = `
            <span class="swatch" style="background:${color}"></span>
            <span class="legend-angle">${angle}°</span>
            <span class="legend-note">${note}</span>
            <span class="legend-range">${range.toFixed(0)} m</span>`;
          return li;
        }),
      );
    },
  };
}
