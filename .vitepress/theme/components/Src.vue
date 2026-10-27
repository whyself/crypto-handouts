<script setup lang="ts">
// 原课件页码标签；ignore-header 让它不进入右侧目录
defineProps<{ p: string }>()
</script>

<template>
  <span class="src ignore-header">P{{ p }}</span>
</template>
