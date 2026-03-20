<template>
  <div class="restocking">
    <div class="page-header">
      <h2>Restocking Planner</h2>
      <p>Set your available budget and place restocking orders based on demand forecasts.</p>
    </div>

    <!-- Success banner -->
    <div v-if="successMessage" class="banner banner-success">
      {{ successMessage }}
    </div>

    <!-- Error banner -->
    <div v-if="submitError" class="banner banner-error">
      {{ submitError }}
    </div>

    <div v-if="loading" class="loading">Loading demand and inventory data...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>

      <!-- Budget Slider Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Budget</h3>
        </div>
        <div class="budget-section">
          <div class="budget-slider-row">
            <label class="slider-label" for="budget-slider">Available Budget</label>
            <span class="slider-value">${{ budget.toLocaleString() }}</span>
          </div>
          <input
            id="budget-slider"
            type="range"
            class="budget-slider"
            :min="10000"
            :max="500000"
            :step="5000"
            v-model.number="budget"
          />
          <div class="budget-stats">
            <div class="budget-stat">
              <span class="budget-stat-label">Budget</span>
              <span class="budget-stat-value">${{ budget.toLocaleString() }}</span>
            </div>
            <div class="budget-stat">
              <span class="budget-stat-label">Allocated</span>
              <span class="budget-stat-value" :class="{ 'over-budget': allocatedBudget > budget }">
                ${{ allocatedBudget.toLocaleString() }}
              </span>
            </div>
            <div class="budget-stat">
              <span class="budget-stat-label">Remaining</span>
              <span class="budget-stat-value" :class="{ 'over-budget': allocatedBudget > budget }">
                ${{ (budget - allocatedBudget).toLocaleString() }}
              </span>
            </div>
          </div>
          <div class="progress-track">
            <div
              class="progress-fill"
              :class="{ 'progress-over': allocatedBudget > budget }"
              :style="{ width: Math.min(100, (allocatedBudget / budget) * 100) + '%' }"
            ></div>
          </div>
          <div class="progress-label">
            {{ Math.min(100, Math.round((allocatedBudget / budget) * 100)) }}% allocated
          </div>
        </div>
      </div>

      <!-- Recommendations Table Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recommendations ({{ recommendations.length }} items)</h3>
          <span class="card-subtitle">
            {{ checkedSkus.size }} selected
          </span>
        </div>

        <div v-if="recommendations.length === 0" class="empty-state">
          No restocking recommendations at this time. All inventory meets forecasted demand.
        </div>

        <div v-else class="table-container">
          <table class="restock-table">
            <thead>
              <tr>
                <th class="col-check"></th>
                <th class="col-sku">SKU</th>
                <th class="col-name">Item Name</th>
                <th class="col-trend">Trend</th>
                <th class="col-cost">Unit Cost</th>
                <th class="col-qty">Qty</th>
                <th class="col-total">Line Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in recommendations"
                :key="item.sku"
                :class="{ 'row-dimmed': !item.affordable }"
              >
                <td class="col-check">
                  <input
                    type="checkbox"
                    :checked="checkedSkus.has(item.sku)"
                    :disabled="!item.affordable"
                    @change="toggleChecked(item.sku)"
                  />
                </td>
                <td class="col-sku">
                  <code class="sku-code">{{ item.sku }}</code>
                </td>
                <td class="col-name">{{ item.name }}</td>
                <td class="col-trend">
                  <span :class="['badge', trendClass(item.trend)]">{{ item.trend }}</span>
                </td>
                <td class="col-cost">${{ item.unit_cost.toLocaleString() }}</td>
                <td class="col-qty">
                  <input
                    type="number"
                    class="qty-input"
                    :min="1"
                    :value="qtyOverrides[item.sku] !== undefined ? qtyOverrides[item.sku] : item.recommended_qty"
                    :disabled="!item.affordable"
                    @change="handleQtyChange(item.sku, $event)"
                  />
                </td>
                <td class="col-total">
                  <strong>${{ getLineTotal(item).toLocaleString() }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Place Order Button -->
      <div class="order-footer">
        <div class="order-summary">
          <span class="order-summary-label">Total Order Value:</span>
          <span class="order-summary-value" :class="{ 'over-budget': allocatedBudget > budget }">
            ${{ allocatedBudget.toLocaleString() }}
          </span>
        </div>
        <button
          class="btn-place-order"
          :disabled="checkedSkus.size === 0 || allocatedBudget > budget || submitting"
          @click="placeOrder"
        >
          {{ submitting ? 'Placing Order...' : 'Place Order' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../api'

const TREND_PRIORITY = { increasing: 0, stable: 1, decreasing: 2 }

export default {
  name: 'Restocking',
  setup() {
    // ── Raw data ─────────────────────────────────────────────────────────────
    const loading = ref(true)
    const error = ref(null)
    const demandForecasts = ref([])
    const inventoryItems = ref([])

    // ── UI state ──────────────────────────────────────────────────────────────
    const budget = ref(100000)
    const qtyOverrides = ref({})
    const checkedSkus = ref(new Set())
    const submitting = ref(false)
    const successMessage = ref(null)
    const submitError = ref(null)

    // ── Data loading ──────────────────────────────────────────────────────────
    const loadData = async () => {
      loading.value = true
      error.value = null
      try {
        const [forecasts, inventory] = await Promise.all([
          api.getDemandForecasts(),
          api.getInventory()
        ])
        demandForecasts.value = forecasts
        inventoryItems.value = inventory
      } catch (err) {
        error.value = 'Failed to load data: ' + err.message
        console.error(err)
      } finally {
        loading.value = false
      }
    }

    // ── Cost map ──────────────────────────────────────────────────────────────
    const inventoryCostMap = computed(() => {
      const map = {}
      for (const item of inventoryItems.value) {
        map[item.sku] = item.unit_cost
      }
      return map
    })

    // ── Greedy recommendations ────────────────────────────────────────────────
    const recommendations = computed(() => {
      const costMap = inventoryCostMap.value

      // Build candidate list
      const candidates = demandForecasts.value
        .map(item => {
          const unit_cost = costMap[item.item_sku] ?? 50
          const recommended_qty = Math.max(0, item.forecasted_demand - item.current_demand)
          const line_total = recommended_qty * unit_cost
          return {
            sku: item.item_sku,
            name: item.item_name,
            trend: item.trend,
            unit_cost,
            recommended_qty,
            line_total,
            gap: item.forecasted_demand - item.current_demand
          }
        })
        .filter(item => item.recommended_qty > 0)

      // Sort: trend priority first, then gap descending
      candidates.sort((a, b) => {
        const tp = (TREND_PRIORITY[a.trend] ?? 99) - (TREND_PRIORITY[b.trend] ?? 99)
        if (tp !== 0) return tp
        return b.gap - a.gap
      })

      // Greedy fill
      let remaining = budget.value
      const result = []

      for (const item of candidates) {
        if (item.line_total <= remaining) {
          // Full quantity fits
          result.push({ ...item, affordable: true })
          remaining -= item.line_total
        } else {
          // Check if at least 1 unit fits
          const maxAffordable = Math.floor(remaining / item.unit_cost)
          if (maxAffordable >= 1) {
            result.push({
              ...item,
              recommended_qty: maxAffordable,
              line_total: maxAffordable * item.unit_cost,
              affordable: true
            })
            remaining -= maxAffordable * item.unit_cost
          } else {
            result.push({ ...item, affordable: false })
          }
        }
      }

      return result
    })

    // When budget changes or recommendations recompute, reset overrides + checkedSkus
    watch(
      () => budget.value,
      () => {
        qtyOverrides.value = {}
        const affordable = recommendations.value
          .filter(r => r.affordable)
          .map(r => r.sku)
        checkedSkus.value = new Set(affordable)
      }
    )

    // Also seed checkedSkus when data first loads
    watch(
      recommendations,
      (recs) => {
        // Only seed on first load (when checkedSkus is empty)
        if (checkedSkus.value.size === 0 && recs.length > 0) {
          const affordable = recs.filter(r => r.affordable).map(r => r.sku)
          checkedSkus.value = new Set(affordable)
        }
      },
      { immediate: false }
    )

    // ── Derived quantities ────────────────────────────────────────────────────
    const getEffectiveQty = (item) => {
      return qtyOverrides.value[item.sku] !== undefined
        ? qtyOverrides.value[item.sku]
        : item.recommended_qty
    }

    const getLineTotal = (item) => {
      return getEffectiveQty(item) * item.unit_cost
    }

    const allocatedBudget = computed(() => {
      let total = 0
      for (const item of recommendations.value) {
        if (checkedSkus.value.has(item.sku)) {
          total += getLineTotal(item)
        }
      }
      return total
    })

    // ── Event handlers ────────────────────────────────────────────────────────
    const toggleChecked = (sku) => {
      const next = new Set(checkedSkus.value)
      if (next.has(sku)) {
        next.delete(sku)
      } else {
        next.add(sku)
      }
      checkedSkus.value = next
    }

    const handleQtyChange = (sku, event) => {
      const raw = parseInt(event.target.value, 10)
      if (!isNaN(raw) && raw >= 1) {
        qtyOverrides.value = { ...qtyOverrides.value, [sku]: raw }
      }
    }

    // ── Place order ───────────────────────────────────────────────────────────
    const placeOrder = async () => {
      successMessage.value = null
      submitError.value = null
      submitting.value = true

      try {
        const items = recommendations.value
          .filter(item => checkedSkus.value.has(item.sku))
          .map(item => ({
            sku: item.sku,
            name: item.name,
            quantity: getEffectiveQty(item),
            unit_cost: item.unit_cost
          }))

        const result = await api.submitRestockingOrder(items)
        successMessage.value = `Order ${result.order_number} placed — delivery in 14 days.`

        // Clear selections after success, keep slider
        checkedSkus.value = new Set()
        qtyOverrides.value = {}
      } catch (err) {
        submitError.value = 'Failed to place order: ' + (err.response?.data?.detail || err.message)
        console.error(err)
      } finally {
        submitting.value = false
      }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    const trendClass = (trend) => {
      if (trend === 'increasing') return 'success'
      if (trend === 'decreasing') return 'danger'
      return 'stable'
    }

    onMounted(loadData)

    return {
      loading,
      error,
      budget,
      qtyOverrides,
      checkedSkus,
      submitting,
      successMessage,
      submitError,
      recommendations,
      allocatedBudget,
      toggleChecked,
      handleQtyChange,
      placeOrder,
      trendClass,
      getLineTotal
    }
  }
}
</script>

<style scoped>
/* ── Banners ─────────────────────────────────────────────────────────────── */
.banner {
  padding: 0.875rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.938rem;
  font-weight: 500;
}

.banner-success {
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  color: #065f46;
}

.banner-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

/* ── Budget section ──────────────────────────────────────────────────────── */
.budget-section {
  padding: 0.25rem 0;
}

.budget-slider-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.slider-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.slider-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.budget-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  appearance: none;
  background: #e2e8f0;
  outline: none;
  cursor: pointer;
  margin-bottom: 1.25rem;
}

.budget-slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.4);
  transition: transform 0.15s ease;
}

.budget-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.budget-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.4);
}

.budget-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.budget-stat {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.budget-stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.budget-stat-value {
  font-size: 1.375rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.budget-stat-value.over-budget {
  color: #dc2626;
}

/* ── Progress bar ────────────────────────────────────────────────────────── */
.progress-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease, background 0.3s ease;
}

.progress-fill.progress-over {
  background: #ef4444;
}

.progress-label {
  font-size: 0.813rem;
  color: #64748b;
  text-align: right;
}

/* ── Card subtitle ───────────────────────────────────────────────────────── */
.card-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

/* ── Table ───────────────────────────────────────────────────────────────── */
.restock-table {
  table-layout: fixed;
  width: 100%;
}

.col-check {
  width: 44px;
}

.col-sku {
  width: 130px;
}

.col-name {
  /* flexible */
}

.col-trend {
  width: 120px;
}

.col-cost {
  width: 110px;
}

.col-qty {
  width: 100px;
}

.col-total {
  width: 120px;
}

.row-dimmed {
  opacity: 0.45;
}

.sku-code {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.813rem;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  color: #334155;
}

.qty-input {
  width: 72px;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #0f172a;
  background: #ffffff;
  outline: none;
  transition: border-color 0.15s ease;
}

.qty-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.qty-input:disabled {
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
  font-size: 0.938rem;
}

/* ── Order footer ────────────────────────────────────────────────────────── */
.order-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.5rem;
  padding: 1rem 0 0.5rem;
}

.order-summary {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.order-summary-label {
  font-size: 0.938rem;
  color: #64748b;
  font-weight: 500;
}

.order-summary-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.order-summary-value.over-budget {
  color: #dc2626;
}

.btn-place-order {
  padding: 0.75rem 2rem;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.938rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, opacity 0.2s ease, transform 0.1s ease;
  letter-spacing: 0.01em;
}

.btn-place-order:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.btn-place-order:active:not(:disabled) {
  transform: translateY(0);
}

.btn-place-order:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: #64748b;
}
</style>
