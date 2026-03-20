<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && backlogItem" class="modal-overlay" @click="close">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">
              {{ mode === 'create' ? t('purchaseOrder.createTitle') : t('purchaseOrder.viewTitle') }}
            </h3>
            <button class="close-button" @click="close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- Backlog item info banner (both modes) -->
            <div class="item-banner">
              <div class="item-banner-info">
                <div class="item-banner-name">{{ backlogItem.item_name }}</div>
                <div class="item-banner-sku">SKU: {{ backlogItem.item_sku }}</div>
              </div>
              <div class="item-banner-stat">
                <div class="stat-label">{{ t('purchaseOrder.quantityNeeded') }}</div>
                <div class="stat-value">{{ backlogItem.quantity_needed }} units</div>
              </div>
              <span class="priority-badge" :class="backlogItem.priority">
                {{ backlogItem.priority }} {{ t('purchaseOrder.priority') }}
              </span>
            </div>

            <!-- CREATE MODE: form -->
            <template v-if="mode === 'create'">
              <form @submit.prevent="submitForm" class="po-form">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="supplier-name">
                      {{ t('purchaseOrder.supplierName') }} <span class="required">*</span>
                    </label>
                    <input
                      id="supplier-name"
                      v-model="form.supplier_name"
                      type="text"
                      class="form-input"
                      :class="{ 'input-error': formErrors.supplier_name }"
                      :placeholder="t('purchaseOrder.supplierNamePlaceholder')"
                      required
                    />
                    <span v-if="formErrors.supplier_name" class="error-message">
                      {{ formErrors.supplier_name }}
                    </span>
                  </div>
                </div>

                <div class="form-row two-col">
                  <div class="form-group">
                    <label class="form-label" for="quantity">
                      {{ t('purchaseOrder.quantity') }} <span class="required">*</span>
                    </label>
                    <input
                      id="quantity"
                      v-model.number="form.quantity"
                      type="number"
                      class="form-input"
                      :class="{ 'input-error': formErrors.quantity }"
                      min="1"
                      required
                    />
                    <span v-if="formErrors.quantity" class="error-message">
                      {{ formErrors.quantity }}
                    </span>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="unit-cost">
                      {{ t('purchaseOrder.unitCost') }}
                    </label>
                    <input
                      id="unit-cost"
                      v-model.number="form.unit_cost"
                      type="number"
                      class="form-input"
                      step="0.01"
                      min="0"
                      :placeholder="t('purchaseOrder.unitCostPlaceholder')"
                    />
                  </div>
                </div>

                <!-- Total cost preview when both quantity and unit cost are set -->
                <div v-if="estimatedTotal > 0" class="cost-preview">
                  <span class="cost-preview-label">{{ t('purchaseOrder.estimatedTotal') }}:</span>
                  <span class="cost-preview-value">{{ formatCurrency(estimatedTotal, currentCurrency) }}</span>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="expected-delivery">
                      {{ t('purchaseOrder.expectedDelivery') }}
                    </label>
                    <input
                      id="expected-delivery"
                      v-model="form.expected_delivery_date"
                      type="date"
                      class="form-input"
                      :min="todayIso"
                    />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="notes">
                      {{ t('purchaseOrder.notes') }}
                    </label>
                    <textarea
                      id="notes"
                      v-model="form.notes"
                      class="form-textarea"
                      rows="3"
                      :placeholder="t('purchaseOrder.notesPlaceholder')"
                    ></textarea>
                  </div>
                </div>

                <div v-if="submitError" class="alert-error">
                  {{ submitError }}
                </div>
              </form>
            </template>

            <!-- VIEW MODE: read-only PO details -->
            <template v-else>
              <div v-if="viewLoading" class="state-loading">
                <div class="spinner"></div>
                <span>{{ t('common.loading') }}</span>
              </div>

              <div v-else-if="viewError" class="alert-error">
                {{ viewError }}
              </div>

              <div v-else-if="poData" class="info-grid">
                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.supplierName') }}</div>
                  <div class="info-value">{{ poData.supplier_name }}</div>
                </div>

                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.quantity') }}</div>
                  <div class="info-value">{{ poData.quantity }} units</div>
                </div>

                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.unitCost') }}</div>
                  <div class="info-value">
                    {{ poData.unit_cost != null ? formatCurrency(poData.unit_cost, currentCurrency) : 'N/A' }}
                  </div>
                </div>

                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.expectedDelivery') }}</div>
                  <div class="info-value">{{ formatDate(poData.expected_delivery_date) }}</div>
                </div>

                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.status') }}</div>
                  <div class="info-value">
                    <span class="badge" :class="statusBadgeClass(poData.status)">
                      {{ poData.status }}
                    </span>
                  </div>
                </div>

                <div class="info-item">
                  <div class="info-label">{{ t('purchaseOrder.createdDate') }}</div>
                  <div class="info-value">{{ formatDate(poData.created_at) }}</div>
                </div>

                <div v-if="poData.notes" class="info-item full-width">
                  <div class="info-label">{{ t('purchaseOrder.notes') }}</div>
                  <div class="info-value notes-text">{{ poData.notes }}</div>
                </div>
              </div>

              <div v-else class="state-empty">
                {{ t('purchaseOrder.noPoFound') }}
              </div>
            </template>
          </div>

          <div class="modal-footer">
            <template v-if="mode === 'create'">
              <button class="btn-secondary" @click="close" :disabled="submitting">
                {{ t('common.cancel') }}
              </button>
              <button
                class="btn-primary"
                :disabled="submitting"
                @click="submitForm"
              >
                <span v-if="submitting" class="spinner-inline"></span>
                {{ submitting ? t('purchaseOrder.creating') : t('purchaseOrder.createPo') }}
              </button>
            </template>

            <template v-else>
              <button class="btn-secondary" @click="close">
                {{ t('common.close') }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from '../composables/useI18n'
import { formatCurrency } from '../utils/currency'
import { api } from '../api'

const { t, currentCurrency } = useI18n()

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  backlogItem: {
    type: Object,
    default: null
  },
  mode: {
    type: String,
    default: 'create'
  }
})

const emit = defineEmits(['close', 'po-created'])

// Today's ISO date string used as the min value for the delivery date picker
const todayIso = new Date().toISOString().split('T')[0]

// ── Create mode state ─────────────────────────────────────────────────────────
const form = ref({
  supplier_name: '',
  quantity: 0,
  unit_cost: null,
  expected_delivery_date: '',
  notes: ''
})

const formErrors = ref({})
const submitError = ref(null)
const submitting = ref(false)

// ── View mode state ───────────────────────────────────────────────────────────
const poData = ref(null)
const viewLoading = ref(false)
const viewError = ref(null)

// ── Computed ──────────────────────────────────────────────────────────────────

// Pre-fill quantity as the shortage amount (needed minus available)
const defaultQuantity = computed(() => {
  if (!props.backlogItem) return 1
  const shortage = (props.backlogItem.quantity_needed ?? 0) - (props.backlogItem.quantity_available ?? 0)
  return shortage > 0 ? shortage : 1
})

const estimatedTotal = computed(() => {
  const qty = form.value.quantity
  const cost = form.value.unit_cost
  if (!qty || !cost || qty <= 0 || cost <= 0) return 0
  return qty * cost
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'N/A'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const statusBadgeClass = (status) => {
  if (!status) return ''
  const map = {
    pending: 'warning',
    approved: 'info',
    ordered: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger'
  }
  return map[status.toLowerCase()] ?? ''
}

// ── Form logic ────────────────────────────────────────────────────────────────
const resetForm = () => {
  form.value = {
    supplier_name: '',
    quantity: defaultQuantity.value,
    unit_cost: null,
    expected_delivery_date: '',
    notes: ''
  }
  formErrors.value = {}
  submitError.value = null
}

const validateForm = () => {
  const errors = {}
  if (!form.value.supplier_name.trim()) {
    errors.supplier_name = t('purchaseOrder.supplierRequired')
  }
  if (!form.value.quantity || form.value.quantity < 1) {
    errors.quantity = t('purchaseOrder.quantityRequired')
  }
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const submitForm = async () => {
  if (!validateForm()) return

  submitting.value = true
  submitError.value = null

  try {
    const payload = {
      backlog_item_id: props.backlogItem.id,
      supplier_name: form.value.supplier_name.trim(),
      quantity: form.value.quantity,
      unit_cost: form.value.unit_cost ?? null,
      expected_delivery_date: form.value.expected_delivery_date || null,
      notes: form.value.notes.trim() || null
    }
    const result = await api.createPurchaseOrder(payload)
    emit('po-created', result)
    emit('close')
  } catch (err) {
    submitError.value = t('purchaseOrder.createError')
    console.error('PO creation failed:', err)
  } finally {
    submitting.value = false
  }
}

// ── View mode data fetch ──────────────────────────────────────────────────────
const fetchPo = async () => {
  if (!props.backlogItem) return
  viewLoading.value = true
  viewError.value = null
  poData.value = null

  try {
    poData.value = await api.getPurchaseOrderByBacklogItem(props.backlogItem.id)
  } catch (err) {
    viewError.value = t('purchaseOrder.fetchError')
    console.error('PO fetch failed:', err)
  } finally {
    viewLoading.value = false
  }
}

// ── Watchers ──────────────────────────────────────────────────────────────────
watch(
  () => props.isOpen,
  (opened) => {
    if (opened) {
      if (props.mode === 'create') {
        resetForm()
        // Set quantity after reset so defaultQuantity computed reflects current backlogItem
        form.value.quantity = defaultQuantity.value
      } else {
        fetchPo()
      }
    } else {
      // Clean up state when modal is dismissed
      resetForm()
      poData.value = null
      viewError.value = null
    }
  }
)

const close = () => {
  emit('close')
}
</script>

<style scoped>
/* ── Overlay & container ───────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  max-width: 640px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.close-button {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

/* ── Body ──────────────────────────────────────────────────────────────────── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.75rem 2rem;
}

/* ── Item banner ───────────────────────────────────────────────────────────── */
.item-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 1.75rem;
}

.item-banner-info {
  flex: 1;
  min-width: 0;
}

.item-banner-name {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-banner-sku {
  font-size: 0.813rem;
  color: #64748b;
  font-family: 'Monaco', 'Courier New', monospace;
  margin-top: 0.25rem;
}

.item-banner-stat {
  text-align: right;
  flex-shrink: 0;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
}

/* ── Priority badge ────────────────────────────────────────────────────────── */
.priority-badge {
  padding: 0.375rem 0.875rem;
  border-radius: 6px;
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  flex-shrink: 0;
}

.priority-badge.high {
  background: #fecaca;
  color: #991b1b;
}

.priority-badge.medium {
  background: #fed7aa;
  color: #92400e;
}

.priority-badge.low {
  background: #dbeafe;
  color: #1e40af;
}

/* ── Form ──────────────────────────────────────────────────────────────────── */
.po-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: flex;
  flex-direction: column;
}

.form-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.required {
  color: #ef4444;
}

.form-input {
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.938rem;
  color: #0f172a;
  background: white;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.input-error {
  border-color: #ef4444;
}

.form-textarea {
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.938rem;
  color: #0f172a;
  background: white;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
  resize: vertical;
  width: 100%;
  box-sizing: border-box;
}

.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-message {
  font-size: 0.813rem;
  color: #ef4444;
}

/* ── Cost preview ──────────────────────────────────────────────────────────── */
.cost-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  font-size: 0.875rem;
}

.cost-preview-label {
  color: #64748b;
  font-weight: 500;
}

.cost-preview-value {
  color: #1d4ed8;
  font-weight: 700;
}

/* ── Alert error ───────────────────────────────────────────────────────────── */
.alert-error {
  padding: 0.875rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
  font-size: 0.875rem;
  font-weight: 500;
}

/* ── View mode info grid ───────────────────────────────────────────────────── */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.info-value {
  font-size: 0.938rem;
  color: #0f172a;
  font-weight: 500;
}

.notes-text {
  white-space: pre-wrap;
  font-weight: 400;
  color: #334155;
}

/* ── Status badge ──────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.success {
  background: #dcfce7;
  color: #166534;
}

.badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.badge.danger {
  background: #fecaca;
  color: #991b1b;
}

.badge.info,
.badge.primary {
  background: #dbeafe;
  color: #1e40af;
}

/* ── Loading / empty states ────────────────────────────────────────────────── */
.state-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 0;
  color: #64748b;
  font-size: 0.938rem;
  justify-content: center;
}

.state-empty {
  padding: 2rem 0;
  text-align: center;
  color: #64748b;
  font-size: 0.938rem;
}

/* Circular spinner for view-mode loading */
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* Inline spinner inside the "Create PO" button */
.spinner-inline {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: middle;
  margin-right: 0.375rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Footer ────────────────────────────────────────────────────────────────── */
.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: #3b82f6;
  border: 1px solid #2563eb;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Modal transition animations (mirrors BacklogDetailModal) ──────────────── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>
