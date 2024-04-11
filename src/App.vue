<script>
// import router from './router';


</script>

<template>
  <div class="app">
    <div class="sidebar">
      666
    </div>
    <router-view></router-view>
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  height: 100%;
  display: flex;
}

.sidebar {
  width: 100px;
  border: 1px solid black;
}

@media (min-width: 1024px) {}
</style>
