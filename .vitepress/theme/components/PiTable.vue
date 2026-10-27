<script setup lang="ts">
import { A } from '../lib/crypto'

// 课件 P69 的置换 π
const PI = 'XEUADNBKVMROCQFSYHWGLZIJPT'
</script>

<template>
  <table class="mapping">
    <tbody>
      <tr><td v-for="c in A" :key="c">{{ c }}</td></tr>
      <tr><td v-for="c in PI" :key="c"><b>{{ c }}</b></td></tr>
    </tbody>
  </table>
</template>
