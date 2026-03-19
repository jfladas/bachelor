<script setup>
import { ref, onMounted } from "vue";
const { ipcRenderer } = require('electron');

const pet = ref(null);
const position = ref({ x: 100, y: 100 });
const dragging = ref(false);
const offset = ref({ x: 0, y: 0 });

const startDrag = (event) => {
  dragging.value = true;
  offset.value = {
    x: event.clientX - position.value.x,
    y: event.clientY - position.value.y,
  };
};

const onDrag = (event) => {
  if (dragging.value && pet.value) {
    const newX = event.clientX - offset.value.x;
    const newY = event.clientY - offset.value.y;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const petWidth = pet.value.offsetWidth;
    const petHeight = pet.value.offsetHeight;

    position.value = {
      x: Math.min(Math.max(newX, 0), windowWidth - petWidth),
      y: Math.min(Math.max(newY, 0), windowHeight - petHeight),
    };
  }
};

const stopDrag = () => {
  dragging.value = false;
};

onMounted(() => {
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", stopDrag);
  document.addEventListener('mouseover', (event) => {
    if (event.target.closest('.pet')) {
      ipcRenderer.send('set-ignore-mouse-events', false);
    } else {
      ipcRenderer.send('set-ignore-mouse-events', true);
    }
  });
});
</script>

<template>
  <div ref="pet" class="pet" :style="{
    left: `${position.x}px`,
    top: `${position.y}px`
  }" @mousedown="startDrag">
    👾 <!-- This is a placeholder. Replace with Companion -->
  </div>
</template>

<style scoped>
.pet {
  position: absolute;
  font-size: 5rem;
  cursor: default;
  user-select: none;
}
</style>