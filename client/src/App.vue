<template>
  <div class="app">
    <header class="top-nav">
      <div class="nav-container">
        <div class="logo">
          <h1>{{ t('nav.companyName') }}</h1>
          <span class="subtitle">{{ t('nav.subtitle') }}</span>
        </div>
        <nav class="nav-tabs">
          <router-link to="/" :class="{ active: $route.path === '/' }">
            {{ t('nav.overview') }}
          </router-link>
          <router-link to="/inventory" :class="{ active: $route.path === '/inventory' }">
            {{ t('nav.inventory') }}
          </router-link>
          <router-link to="/orders" :class="{ active: $route.path === '/orders' }">
            {{ t('nav.orders') }}
          </router-link>
          <router-link to="/spending" :class="{ active: $route.path === '/spending' }">
            {{ t('nav.finance') }}
          </router-link>
          <router-link to="/demand" :class="{ active: $route.path === '/demand' }">
            {{ t('nav.demandForecast') }}
          </router-link>
          <router-link to="/reports" :class="{ active: $route.path === '/reports' }">
            Reports
          </router-link>
          <router-link to="/restocking" :class="{ active: $route.path === '/restocking' }">
            Restocking
          </router-link>
        </nav>

        <!-- Global Search Bar -->
        <div class="global-search" ref="searchContainer">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search inventory, orders..."
            class="global-search-input"
            @focus="searchFocused = true"
            @input="onSearchInput"
          />
          <div v-if="showDropdown && searchResults.length > 0" class="search-dropdown">
            <div v-if="inventoryResults.length > 0" class="search-section">
              <div class="search-section-label">Inventory</div>
              <div
                v-for="item in inventoryResults"
                :key="item.sku"
                class="search-result-item"
                @mousedown.prevent="goToInventory(item)"
              >
                <span class="result-name">{{ item.name }}</span>
                <span class="result-meta">{{ item.sku }}</span>
              </div>
            </div>
            <div v-if="orderResults.length > 0" class="search-section">
              <div class="search-section-label">Orders</div>
              <div
                v-for="order in orderResults"
                :key="order.id"
                class="search-result-item"
                @mousedown.prevent="goToOrders(order)"
              >
                <span class="result-name">{{ order.order_number }}</span>
                <span class="result-meta">{{ order.customer }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="showDropdown && searchQuery.trim().length >= 2 && searchResults.length === 0" class="search-dropdown search-no-results">
            No results found
          </div>
        </div>

        <!-- Dark Mode Toggle -->
        <button class="dark-mode-toggle" @click="toggleDarkMode" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
          <!-- Sun icon (shown in dark mode to switch to light) -->
          <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <!-- Moon icon (shown in light mode to switch to dark) -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>

        <LanguageSwitcher />
        <ProfileMenu
          @show-profile-details="showProfileDetails = true"
          @show-tasks="showTasks = true"
        />
      </div>
    </header>
    <FilterBar />
    <main class="main-content">
      <!-- Low Stock Alert Banner -->
      <LowStockAlert :inventory-items="inventoryItems" />
      <router-view />
    </main>

    <ProfileDetailsModal
      :is-open="showProfileDetails"
      @close="showProfileDetails = false"
    />

    <TasksModal
      :is-open="showTasks"
      :tasks="tasks"
      @close="showTasks = false"
      @add-task="addTask"
      @delete-task="deleteTask"
      @toggle-task="toggleTask"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from './api'
import { useAuth } from './composables/useAuth'
import { useI18n } from './composables/useI18n'
import FilterBar from './components/FilterBar.vue'
import ProfileMenu from './components/ProfileMenu.vue'
import ProfileDetailsModal from './components/ProfileDetailsModal.vue'
import TasksModal from './components/TasksModal.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import LowStockAlert from './components/LowStockAlert.vue'

export default {
  name: 'App',
  components: {
    FilterBar,
    ProfileMenu,
    ProfileDetailsModal,
    TasksModal,
    LanguageSwitcher,
    LowStockAlert
  },
  setup() {
    const { currentUser } = useAuth()
    const { t } = useI18n()
    const router = useRouter()
    const showProfileDetails = ref(false)
    const showTasks = ref(false)
    const apiTasks = ref([])

    // ------- Dark Mode -------
    const isDark = ref(false)

    const applyDarkMode = (dark) => {
      if (dark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    const toggleDarkMode = () => {
      isDark.value = !isDark.value
      localStorage.setItem('darkMode', isDark.value ? '1' : '0')
      applyDarkMode(isDark.value)
    }

    // ------- Global Search -------
    const searchQuery = ref('')
    const searchFocused = ref(false)
    const inventoryItems = ref([])
    const allOrders = ref([])
    const searchContainer = ref(null)

    const showDropdown = computed(() => {
      return searchFocused.value && searchQuery.value.trim().length >= 2
    })

    const inventoryResults = computed(() => {
      if (searchQuery.value.trim().length < 2) return []
      const q = searchQuery.value.toLowerCase().trim()
      return inventoryItems.value.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q))
      ).slice(0, 4)
    })

    const orderResults = computed(() => {
      if (searchQuery.value.trim().length < 2) return []
      const q = searchQuery.value.toLowerCase().trim()
      return allOrders.value.filter(order =>
        (order.order_number && order.order_number.toLowerCase().includes(q)) ||
        (order.customer && order.customer.toLowerCase().includes(q))
      ).slice(0, 4)
    })

    const searchResults = computed(() => [...inventoryResults.value, ...orderResults.value])

    const onSearchInput = () => {
      searchFocused.value = true
    }

    const goToInventory = () => {
      searchQuery.value = ''
      searchFocused.value = false
      router.push('/inventory')
    }

    const goToOrders = () => {
      searchQuery.value = ''
      searchFocused.value = false
      router.push('/orders')
    }

    // Close dropdown when clicking outside
    const handleOutsideClick = (event) => {
      if (searchContainer.value && !searchContainer.value.contains(event.target)) {
        searchFocused.value = false
      }
    }

    // ------- Tasks -------
    const tasks = computed(() => {
      return [...currentUser.value.tasks, ...apiTasks.value]
    })

    const loadTasks = async () => {
      try {
        apiTasks.value = await api.getTasks()
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    }

    const addTask = async (taskData) => {
      try {
        const newTask = await api.createTask(taskData)
        // Add new task to the beginning of the array
        apiTasks.value.unshift(newTask)
      } catch (err) {
        console.error('Failed to add task:', err)
      }
    }

    const deleteTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const isMockTask = currentUser.value.tasks.some(t => t.id === taskId)

        if (isMockTask) {
          // Remove from mock tasks
          const index = currentUser.value.tasks.findIndex(t => t.id === taskId)
          if (index !== -1) {
            currentUser.value.tasks.splice(index, 1)
          }
        } else {
          // Remove from API tasks
          await api.deleteTask(taskId)
          apiTasks.value = apiTasks.value.filter(t => t.id !== taskId)
        }
      } catch (err) {
        console.error('Failed to delete task:', err)
      }
    }

    const toggleTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const mockTask = currentUser.value.tasks.find(t => t.id === taskId)

        if (mockTask) {
          // Toggle mock task status
          mockTask.status = mockTask.status === 'pending' ? 'completed' : 'pending'
        } else {
          // Toggle API task
          const updatedTask = await api.toggleTask(taskId)
          const index = apiTasks.value.findIndex(t => t.id === taskId)
          if (index !== -1) {
            apiTasks.value[index] = updatedTask
          }
        }
      } catch (err) {
        console.error('Failed to toggle task:', err)
      }
    }

    // ------- Load global data for search + low stock alerts -------
    const loadGlobalData = async () => {
      try {
        const [inv, orders] = await Promise.all([
          api.getInventory(),
          api.getOrders()
        ])
        inventoryItems.value = inv
        allOrders.value = orders
      } catch (err) {
        console.error('Failed to load global data:', err)
      }
    }

    onMounted(() => {
      // Restore dark mode preference
      const saved = localStorage.getItem('darkMode')
      if (saved === '1') {
        isDark.value = true
        applyDarkMode(true)
      }

      loadTasks()
      loadGlobalData()

      // Listen for outside clicks to close search dropdown
      document.addEventListener('click', handleOutsideClick)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleOutsideClick)
    })

    return {
      t,
      showProfileDetails,
      showTasks,
      tasks,
      addTask,
      deleteTask,
      toggleTask,
      // dark mode
      isDark,
      toggleDarkMode,
      // search
      searchQuery,
      searchFocused,
      showDropdown,
      inventoryResults,
      orderResults,
      searchResults,
      onSearchInput,
      goToInventory,
      goToOrders,
      searchContainer,
      // low stock
      inventoryItems
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f8fafc;
  color: #1e293b;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.top-nav {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  padding: 0 2rem;
  height: 70px;
}

.nav-container > .nav-tabs {
  margin-left: auto;
  margin-right: 1rem;
}

.nav-container > .language-switcher {
  margin-right: 1rem;
}

.logo {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.logo h1 {
  font-size: 1.375rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.subtitle {
  font-size: 0.813rem;
  color: #64748b;
  font-weight: 400;
  padding-left: 0.75rem;
  border-left: 1px solid #e2e8f0;
}

.nav-tabs {
  display: flex;
  gap: 0.25rem;
}

.nav-tabs a {
  padding: 0.625rem 1.25rem;
  color: #64748b;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.938rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  position: relative;
}

.nav-tabs a:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.nav-tabs a.active {
  color: #2563eb;
  background: #eff6ff;
}

.nav-tabs a.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #2563eb;
}

.main-content {
  flex: 1;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 2rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h2 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.375rem;
  letter-spacing: -0.025em;
}

.page-header p {
  color: #64748b;
  font-size: 0.938rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: white;
  padding: 1.25rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.stat-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.stat-label {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.625rem;
}

.stat-value {
  font-size: 2.25rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.stat-card.warning .stat-value {
  color: #ea580c;
}

.stat-card.success .stat-value {
  color: #059669;
}

.stat-card.danger .stat-value {
  color: #dc2626;
}

.stat-card.info .stat-value {
  color: #2563eb;
}

.card {
  background: white;
  border-radius: 10px;
  padding: 1.25rem;
  border: 1px solid #e2e8f0;
  margin-bottom: 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid #e2e8f0;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}

th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  color: #475569;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

td {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid #f1f5f9;
  color: #334155;
  font-size: 0.875rem;
}

tbody tr {
  transition: background-color 0.15s ease;
}

tbody tr:hover {
  background: #f8fafc;
}

.badge {
  display: inline-block;
  padding: 0.313rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.badge.success {
  background: #d1fae5;
  color: #065f46;
}

.badge.warning {
  background: #fed7aa;
  color: #92400e;
}

.badge.danger {
  background: #fecaca;
  color: #991b1b;
}

.badge.info {
  background: #dbeafe;
  color: #1e40af;
}

.badge.increasing {
  background: #d1fae5;
  color: #065f46;
}

.badge.decreasing {
  background: #fecaca;
  color: #991b1b;
}

.badge.stable {
  background: #e0e7ff;
  color: #3730a3;
}

.badge.high {
  background: #fecaca;
  color: #991b1b;
}

.badge.medium {
  background: #fed7aa;
  color: #92400e;
}

.badge.low {
  background: #dbeafe;
  color: #1e40af;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #64748b;
  font-size: 0.938rem;
}

.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  font-size: 0.938rem;
}

/* =====================
   Dark Mode Toggle Button
   ===================== */
.dark-mode-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  margin-right: 0.5rem;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s;
}

.dark-mode-toggle:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.dark-mode-toggle svg {
  width: 18px;
  height: 18px;
}

/* =====================
   Global Search
   ===================== */
.global-search {
  position: relative;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.global-search-input {
  width: 220px;
  padding: 0.4rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #0f172a;
  background: #f8fafc;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.global-search-input:focus {
  border-color: #3b82f6;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.global-search-input::placeholder {
  color: #94a3b8;
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 300px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 200;
  overflow: hidden;
}

.search-no-results {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: #64748b;
}

.search-section {
  padding: 0.5rem 0;
}

.search-section + .search-section {
  border-top: 1px solid #f1f5f9;
}

.search-section-label {
  padding: 0.25rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
}

.search-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}

.search-result-item:hover {
  background: #f1f5f9;
}

.result-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-meta {
  font-size: 0.75rem;
  color: #94a3b8;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

/* =====================
   Dark Mode Overrides
   ===================== */
html.dark body {
  background: #0f172a;
  color: #e2e8f0;
}

html.dark .top-nav {
  background: #1e293b;
  border-color: #334155;
}

html.dark .card,
html.dark .stat-card {
  background: #1e293b;
  border-color: #334155;
}

html.dark table thead {
  background: #1e293b;
}

html.dark td,
html.dark th {
  color: #cbd5e1;
  border-color: #334155;
}

html.dark .nav-tabs a {
  color: #94a3b8;
}

html.dark .nav-tabs a:hover {
  background: #334155;
  color: #f1f5f9;
}

html.dark .nav-tabs a.active {
  background: #1e3a5f;
  color: #60a5fa;
}

html.dark .logo h1 {
  color: #f1f5f9;
}

html.dark .subtitle {
  color: #94a3b8;
}

html.dark .main-content {
  background: transparent;
}

html.dark input,
html.dark select {
  background: #1e293b;
  color: #e2e8f0;
  border-color: #475569;
}

html.dark tbody tr:hover {
  background: #1e293b;
}

html.dark .badge.success {
  background: #064e3b;
  color: #6ee7b7;
}

html.dark .badge.warning {
  background: #78350f;
  color: #fcd34d;
}

html.dark .badge.danger {
  background: #7f1d1d;
  color: #fca5a5;
}

html.dark .badge.info {
  background: #1e3a5f;
  color: #93c5fd;
}

html.dark .dark-mode-toggle {
  color: #94a3b8;
}

html.dark .dark-mode-toggle:hover {
  background: #334155;
  color: #f1f5f9;
}

html.dark .global-search-input {
  background: #1e293b;
  color: #e2e8f0;
  border-color: #475569;
}

html.dark .global-search-input::placeholder {
  color: #64748b;
}

html.dark .search-dropdown {
  background: #1e293b;
  border-color: #334155;
}

html.dark .search-result-item:hover {
  background: #334155;
}

html.dark .result-name {
  color: #e2e8f0;
}

html.dark .card-header {
  border-color: #334155;
}

html.dark .card-title {
  color: #e2e8f0;
}

html.dark .stat-value {
  color: #e2e8f0;
}

html.dark .page-header h2 {
  color: #e2e8f0;
}
</style>
