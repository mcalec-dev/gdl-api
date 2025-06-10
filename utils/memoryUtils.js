const debug = require('debug')('gdl-api:memory');
const os = require('os');

// More aggressive memory management thresholds
const MEMORY_THRESHOLDS = {
  WARNING: 1024,     // 1GB
  CRITICAL: 2048,    // 2GB
  FAILURE: 4096      // 4GB
};

const CPU_THRESHOLDS = {
  WARNING: 60,      // 60% CPU usage
  CRITICAL: 75,     // 75% CPU usage
  FAILURE: 90       // 90% CPU usage
};

// Smaller history size to reduce memory overhead
const memoryHistory = {
  readings: [],
  maxSize: 10,      // Only keep last 10 readings
  interval: 150000   // Check every 150 seconds
};

const cpuHistory = {
  readings: [],
  maxSize: 10,
  lastMeasurement: null
};

let lastKnownHeap = 0;
let growthCount = 0;
const LEAK_THRESHOLD = 5;
let consecutiveHighMemory = 0;

function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    heapUsed: Math.round(used.heapUsed / 1024 / 1024), 
    heapTotal: Math.round(used.heapTotal / 1024 / 1024),
    rss: Math.round(used.rss / 1024 / 1024),
    external: Math.round(used.external / 1024 / 1024),
    arrayBuffers: Math.round(used.arrayBuffers / 1024 / 1024),
    timestamp: Date.now()
  };
}

function getCpuUsage() {
  const cpus = os.cpus();
  const numberOfCores = cpus.length;
  
  // Calculate CPU usage across all cores
  const totalCpu = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0);

  // Average CPU usage across cores
  return Math.round(totalCpu / numberOfCores);
}

function measureCpuUsage() {
  const currentUsage = getCpuUsage();
  cpuHistory.readings.push({
    usage: currentUsage,
    timestamp: Date.now()
  });
  if (cpuHistory.readings.length > cpuHistory.maxSize) { cpuHistory.readings.shift(); }
  return currentUsage;
}

function handleHighCpu(cpuUsage) {
  if (cpuUsage >= CPU_THRESHOLDS.FAILURE) {
    debug('CRITICAL: CPU usage exceeded failure threshold! (%d%)', cpuUsage);
    handleCriticalCpu();
  } else if (cpuUsage >= CPU_THRESHOLDS.CRITICAL) {
    debug('WARNING: CPU usage exceeded critical threshold (%d%)', cpuUsage);
  } else if (cpuUsage >= CPU_THRESHOLDS.WARNING) {
    debug('NOTICE: CPU usage exceeded warning threshold (%d%)', cpuUsage);
  }
}

function handleCriticalCpu() {
  cpuHistory.readings = [];
  debug('Cleared CPU history due to critical CPU usage');
}

function checkMemoryLeaks(currentHeap) {
  // Calculate heap growth rate
  const heapGrowthRate = lastKnownHeap ? (currentHeap - lastKnownHeap) / lastKnownHeap * 100 : 0;
  if (currentHeap > lastKnownHeap) {
    growthCount++;
    // More aggressive leak detection
    if (growthCount >= LEAK_THRESHOLD || heapGrowthRate > 20) {
      debug('Memory leak detected! Heap: %d MB, Growth rate: %d%', currentHeap, heapGrowthRate);
      handleMemoryLeak(currentHeap);
      growthCount = 0;
    }
  } else { growthCount = 0; }
  // Immediate action on high memory
  if (currentHeap >= MEMORY_THRESHOLDS.WARNING) {
    consecutiveHighMemory++;
    if (consecutiveHighMemory >= 2) { // Reduced threshold for faster response
      debug('High memory usage: %d MB', currentHeap);
      handleHighMemory();
      consecutiveHighMemory = 0;
    }
  } else { consecutiveHighMemory = 0; }
  lastKnownHeap = currentHeap;

  // Force cleanup if memory is critically high
  if (currentHeap >= MEMORY_THRESHOLDS.CRITICAL) {
    debug('Critical memory state! Forcing immediate cleanup');
    if (global.gc) global.gc();
  }
}

function handleMemoryLeak(currentHeap) {
  debug('Attempting to fix memory leak. Current heap: %d MB', currentHeap);
  
  // Force garbage collection
  if (global.gc) {
    debug('Running forced garbage collection');
    global.gc();
  }
  
  // Reset counters
  growthCount = 0;
  consecutiveHighMemory = 0;
  
  // Clear history to prevent memory bloat
  memoryHistory.readings = [];
  cpuHistory.readings = [];
  
  // Log memory after cleanup
  const afterCleanup = getMemoryUsage();
  debug('Memory after leak cleanup: Heap: %d MB, RSS: %d MB', 
    afterCleanup.heapUsed, 
    afterCleanup.rss
  );
}

function logMemoryUsage() {
  const usage = getMemoryUsage();
  const cpuUsage = measureCpuUsage();
  memoryHistory.readings.push(usage);
  if (memoryHistory.readings.length > memoryHistory.maxSize) { memoryHistory.readings.shift(); }
  checkMemoryLeaks(usage.heapUsed);
  handleHighCpu(cpuUsage);
  if (usage.heapUsed >= MEMORY_THRESHOLDS.FAILURE) {
    debug('CRITICAL: Memory usage exceeded failure threshold! Forcing cleanup...');
    handleCriticalMemory();
  } else if (usage.heapUsed >= MEMORY_THRESHOLDS.CRITICAL) {
    debug('WARNING: Memory usage exceeded critical threshold');
    handleHighMemory();
  } else if (usage.heapUsed >= MEMORY_THRESHOLDS.WARNING) {
    debug('NOTICE: Memory usage exceeded warning threshold');
  }
  return { ...usage, cpuUsage };
}

function handleHighMemory() {
  if (global.gc) {
    debug('Running garbage collection');
    global.gc();
  }
}

function handleCriticalMemory() {
  if (global.gc) {
    debug('Running forced garbage collection');
    global.gc();
  }

  memoryHistory.readings = [];
  const afterCleanup = getMemoryUsage();
  debug('Memory after cleanup: Heap: %d MB, RSS: %d MB', 
    afterCleanup.heapUsed, 
    afterCleanup.rss
  );
}

function getMemoryStats() {
  const currentCpu = getCpuUsage();
  return {
    current: {
      ...getMemoryUsage(),
      cpuUsage: currentCpu
    },
    history: {
      memory: memoryHistory.readings,
      cpu: cpuHistory.readings
    },
    thresholds: {
      memory: MEMORY_THRESHOLDS,
      cpu: CPU_THRESHOLDS
    },
    potentialLeak: growthCount >= LEAK_THRESHOLD
  };
}

process.on('SIGTERM', () => { handleCriticalMemory(); });

module.exports = {
  logMemoryUsage,
  getMemoryStats,
  getMemoryUsage,
  handleHighMemory,
  handleCriticalMemory,
  getCpuUsage,
  handleHighCpu,
  handleCriticalCpu
};