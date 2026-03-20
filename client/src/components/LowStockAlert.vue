<template>
  <div v-if="visible && lowStockItems.length > 0" class="low-stock-banner">
    <span class="banner-icon">&#9888;</span>
    <span class="banner-text">
      <strong>{{ lowStockItems.length }} item{{ lowStockItems.length !== 1 ? 's' : '' }} are low on stock:</strong>
      {{ displayNames }}
      <span v-if="remaining > 0"> +{{ remaining }} more</span>
    </span>
    <button class="dismiss-btn" @click="dismiss" title="Dismiss">&#x2715;</button>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'LowStockAlert',
  props: {
    inventoryItems: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    const dismissed = ref(false)

    const lowStockItems = computed(() => {
      return props.inventoryItems.filter(
        item => item.quantity_on_hand <= item.reorder_point
      )
    })

    // Show first 2 names, then "+N more"
    const displayNames = computed(() => {
      return lowStockItems.value.slice(0, 2).map(i => i.name).join(', ')
    })

    const remaining = computed(() => {
      return Math.max(0, lowStockItems.value.length - 2)
    })

    const visible = computed(() => !dismissed.value)

    const dismiss = () => {
      dismissed.value = true
    }

    return {
      lowStockItems,
      displayNames,
      remaining,
      visible,
      dismiss
    }
  }
}
</script>

<style scoped>
.low-stock-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #fef9c3;
  border: 1px solid #fde047;
  color: #854d0e;
  padding: 0.75rem 1.25rem;
  width: 100%;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.banner-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
}

.dismiss-btn {
  background: transparent;
  border: none;
  color: #854d0e;
  cursor: pointer;
  font-size: 1rem;
  padding: 0 0.25rem;
  line-height: 1;
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.dismiss-btn:hover {
  opacity: 1;
}
</style>
