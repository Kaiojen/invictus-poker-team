import threading
import time
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor


TARGET_URL = "http://127.0.0.1:5001/api/registration/check-availability"
CONCURRENCY = 50
DURATION_SECONDS = 60
TIMEOUT_SECONDS = 5


class LoadStats:
    def __init__(self):
        self.lock = threading.Lock()
        self.total = 0
        self.success = 0
        self.errors = 0
        self.timeouts = 0
        self.latencies_ms = []

    def record(self, ok: bool, latency_ms: float, timeout: bool = False):
        with self.lock:
            self.total += 1
            if ok:
                self.success += 1
            else:
                self.errors += 1
            if timeout:
                self.timeouts += 1
            # limitar tamanho para evitar uso excessivo de memoria
            if len(self.latencies_ms) < 20000:
                self.latencies_ms.append(latency_ms)


counter_lock = threading.Lock()
counter_val = 0


def next_seq() -> int:
    global counter_val
    with counter_lock:
        counter_val += 1
        return counter_val


def do_request(stats: LoadStats):
    seq = next_seq()
    payload = {
        "username": f"usr{seq}",
        "email": f"u{seq}@example.com",
        "document": "00000000000",
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        TARGET_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            ok = (resp.status == 200)
            latency_ms = (time.perf_counter() - start) * 1000.0
            stats.record(ok=ok, latency_ms=latency_ms)
    except urllib.error.URLError:
        latency_ms = (time.perf_counter() - start) * 1000.0
        stats.record(ok=False, latency_ms=latency_ms, timeout=True)
    except Exception:
        latency_ms = (time.perf_counter() - start) * 1000.0
        stats.record(ok=False, latency_ms=latency_ms)


def percentile(values, p):
    if not values:
        return 0.0
    values_sorted = sorted(values)
    k = max(0, min(len(values_sorted) - 1, int(round((p / 100.0) * (len(values_sorted) - 1)))))
    return values_sorted[k]


def main():
    stats = LoadStats()
    end_time = time.time() + DURATION_SECONDS

    def worker_loop():
        while time.time() < end_time:
            do_request(stats)

    print(f"Starting load test: {CONCURRENCY} workers for {DURATION_SECONDS}s -> {TARGET_URL}")
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = [pool.submit(worker_loop) for _ in range(CONCURRENCY)]
        for f in futures:
            try:
                f.result()
            except Exception:
                pass
    elapsed = time.perf_counter() - start

    total = stats.total
    success = stats.success
    errors = stats.errors
    timeouts = stats.timeouts
    rps = total / elapsed if elapsed > 0 else 0.0
    lat = stats.latencies_ms
    avg = (sum(lat) / len(lat)) if lat else 0.0
    p50 = percentile(lat, 50)
    p95 = percentile(lat, 95)
    p99 = percentile(lat, 99)
    lmax = max(lat) if lat else 0.0
    lmin = min(lat) if lat else 0.0

    print("--- Results ---")
    print(f"Elapsed(s): {elapsed:.2f}")
    print(f"Total: {total} | Success: {success} | Errors: {errors} | Timeouts: {timeouts}")
    print(f"RPS: {rps:.2f}")
    print(f"Latency(ms) -> avg: {avg:.2f}, p50: {p50:.2f}, p95: {p95:.2f}, p99: {p99:.2f}, min: {lmin:.2f}, max: {lmax:.2f}")


if __name__ == "__main__":
    main()




