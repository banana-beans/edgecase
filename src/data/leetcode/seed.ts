import type { LeetCodeProblem } from "./index";

export const seedProblems: LeetCodeProblem[] = [
  {
    id: "lc-two-sum",
    leetcodeNumber: 1,
    title: "Two Sum",
    difficulty: "easy",
    topics: ["array", "hash-map"],
    problem:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] == 9" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists"],
    approach:
      "Single pass with a hash map. For each value, check if target - value was already seen. If yes, return both indices. Trades O(n) extra space for O(n) time vs the O(n^2) brute force.",
    code: `def two_sum(nums: list[int], target: int) -> list[int]:
    seen: dict[int, int] = {}
    for i, x in enumerate(nums):
        need = target - x
        if need in seen:
            return [seen[need], i]
        seen[x] = i
    return []`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-valid-parens",
    leetcodeNumber: 20,
    title: "Valid Parentheses",
    difficulty: "easy",
    topics: ["stack", "string"],
    problem:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Open brackets must be closed by the same type of brackets and in the correct order.",
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "()[]{}"', output: "true" },
      { input: 's = "(]"', output: "false" },
    ],
    constraints: ["1 <= s.length <= 10^4", "s consists of parentheses only"],
    approach:
      "Stack. Push opens; on a close, the stack top must match. If we hit a close with an empty stack, or a mismatch, return False. At the end the stack must be empty.",
    code: `def is_valid(s: str) -> bool:
    pairs = {')': '(', ']': '[', '}': '{'}
    stack: list[str] = []
    for c in s:
        if c in '([{':
            stack.append(c)
        else:
            if not stack or stack.pop() != pairs[c]:
                return False
    return not stack`,
    language: "python",
    complexity: { time: "O(n)", space: "O(n)" },
  },
  {
    id: "lc-reverse-linked-list",
    leetcodeNumber: 206,
    title: "Reverse Linked List",
    difficulty: "easy",
    topics: ["linked-list", "two-pointers"],
    problem:
      "Given the head of a singly linked list, reverse the list, and return the reversed list.",
    examples: [
      { input: "head = [1,2,3,4,5]", output: "[5,4,3,2,1]" },
      { input: "head = []", output: "[]" },
    ],
    approach:
      "Iterative: keep prev=None, walk the list flipping next pointers as you go. Three-pointer dance — save next, rewire current, advance.",
    code: `class ListNode:
    def __init__(self, val: int = 0, next: 'ListNode | None' = None):
        self.val = val
        self.next = next

def reverse_list(head: ListNode | None) -> ListNode | None:
    prev: ListNode | None = None
    curr = head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-best-time-to-buy-sell",
    leetcodeNumber: 121,
    title: "Best Time to Buy and Sell Stock",
    difficulty: "easy",
    topics: ["array", "dynamic-programming"],
    problem:
      "You are given an array prices where prices[i] is the price of a given stock on the i-th day. You want to maximize your profit by choosing a single day to buy one stock and a different day in the future to sell. Return the maximum profit, or 0 if no profit is possible.",
    examples: [
      { input: "prices = [7,1,5,3,6,4]", output: "5", explanation: "Buy at 1, sell at 6." },
      { input: "prices = [7,6,4,3,1]", output: "0" },
    ],
    approach:
      "Single pass. Track the lowest price seen so far and the best profit achievable selling on the current day. Update both as you walk forward.",
    code: `def max_profit(prices: list[int]) -> int:
    min_price = float('inf')
    best = 0
    for p in prices:
        if p < min_price:
            min_price = p
        elif p - min_price > best:
            best = p - min_price
    return best`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-climbing-stairs",
    leetcodeNumber: 70,
    title: "Climbing Stairs",
    difficulty: "easy",
    topics: ["dynamic-programming", "fibonacci"],
    problem:
      "You are climbing a staircase that takes n steps to reach the top. Each time you can climb either 1 or 2 steps. How many distinct ways can you climb to the top?",
    examples: [
      { input: "n = 2", output: "2", explanation: "1+1, 2" },
      { input: "n = 3", output: "3", explanation: "1+1+1, 1+2, 2+1" },
    ],
    approach:
      "Classic Fibonacci. ways(n) = ways(n-1) + ways(n-2). Iterate with two rolling variables — no need for a full DP array.",
    code: `def climb_stairs(n: int) -> int:
    if n <= 2:
        return n
    a, b = 1, 2
    for _ in range(3, n + 1):
        a, b = b, a + b
    return b`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-max-subarray",
    leetcodeNumber: 53,
    title: "Maximum Subarray (Kadane's)",
    difficulty: "medium",
    topics: ["array", "dynamic-programming", "kadane"],
    problem:
      "Given an integer array nums, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum.",
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6", explanation: "[4,-1,2,1] sums to 6." },
      { input: "nums = [1]", output: "1" },
    ],
    approach:
      "Kadane's algorithm. Keep a running sum; if it ever goes negative, reset to the current element (a negative prefix can only hurt future sums). Track the global max.",
    code: `def max_subarray(nums: list[int]) -> int:
    best = curr = nums[0]
    for x in nums[1:]:
        curr = max(x, curr + x)
        if curr > best:
            best = curr
    return best`,
    language: "python",
    complexity: { time: "O(n)", space: "O(1)" },
  },
  {
    id: "lc-longest-substring-no-repeat",
    leetcodeNumber: 3,
    title: "Longest Substring Without Repeating Characters",
    difficulty: "medium",
    topics: ["string", "sliding-window", "hash-map"],
    problem:
      "Given a string s, find the length of the longest substring without repeating characters.",
    examples: [
      { input: 's = "abcabcbb"', output: "3", explanation: '"abc"' },
      { input: 's = "bbbbb"', output: "1" },
      { input: 's = "pwwkew"', output: "3", explanation: '"wke"' },
    ],
    approach:
      "Sliding window with a hash map of last-seen index per character. Right pointer expands; left jumps forward past any repeat. Track max window length.",
    code: `def length_of_longest_substring(s: str) -> int:
    last: dict[str, int] = {}
    left = 0
    best = 0
    for right, c in enumerate(s):
        if c in last and last[c] >= left:
            left = last[c] + 1
        last[c] = right
        best = max(best, right - left + 1)
    return best`,
    language: "python",
    complexity: { time: "O(n)", space: "O(min(n, alphabet))" },
  },
  {
    id: "lc-merge-intervals",
    leetcodeNumber: 56,
    title: "Merge Intervals",
    difficulty: "medium",
    topics: ["array", "sorting", "intervals"],
    problem:
      "Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.",
    examples: [
      { input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]" },
      { input: "intervals = [[1,4],[4,5]]", output: "[[1,5]]", explanation: "Touching intervals merge." },
    ],
    approach:
      "Sort by start. Walk once: if the current interval overlaps the last in the output (start <= last.end), extend last.end; otherwise append.",
    code: `def merge(intervals: list[list[int]]) -> list[list[int]]:
    if not intervals:
        return []
    intervals.sort(key=lambda x: x[0])
    out = [intervals[0]]
    for start, end in intervals[1:]:
        if start <= out[-1][1]:
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out`,
    language: "python",
    complexity: { time: "O(n log n)", space: "O(n)" },
  },
  {
    id: "lc-course-schedule",
    leetcodeNumber: 207,
    title: "Course Schedule (Cycle in DAG)",
    difficulty: "medium",
    topics: ["graph", "topological-sort", "dfs"],
    problem:
      "There are numCourses courses labeled 0..numCourses-1. You are given prerequisites where prerequisites[i] = [a, b] means you must take b before a. Return true if you can finish all courses (i.e. the dependency graph has no cycle).",
    examples: [
      { input: "numCourses = 2, prerequisites = [[1,0]]", output: "true" },
      { input: "numCourses = 2, prerequisites = [[1,0],[0,1]]", output: "false", explanation: "Cycle." },
    ],
    approach:
      "Kahn's algorithm (BFS topo sort). Build adjacency + indegree. Start with indegree-0 nodes, repeatedly pop and decrement neighbors. If you process every node, no cycle.",
    code: `from collections import deque

def can_finish(num_courses: int, prerequisites: list[list[int]]) -> bool:
    graph: list[list[int]] = [[] for _ in range(num_courses)]
    indeg = [0] * num_courses
    for a, b in prerequisites:
        graph[b].append(a)
        indeg[a] += 1

    q = deque(i for i in range(num_courses) if indeg[i] == 0)
    seen = 0
    while q:
        node = q.popleft()
        seen += 1
        for nxt in graph[node]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                q.append(nxt)
    return seen == num_courses`,
    language: "python",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
  },
  {
    id: "lc-lru-cache",
    leetcodeNumber: 146,
    title: "LRU Cache",
    difficulty: "medium",
    topics: ["hash-map", "linked-list", "design"],
    problem:
      "Design a data structure that implements an LRU (Least Recently Used) cache with O(1) get and put. When capacity is reached, evict the least recently used key.",
    examples: [
      {
        input: 'LRUCache(2); put(1,1); put(2,2); get(1); put(3,3); get(2)',
        output: "1, then -1",
        explanation: "Putting 3 evicts key 2 (least recently used).",
      },
    ],
    approach:
      "OrderedDict gives us both hash-map and ordering in one structure. On get, move the key to the end. On put, set then move-to-end; if over capacity, popitem(last=False) to evict the oldest.",
    code: `from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.store: OrderedDict[int, int] = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.store:
            return -1
        self.store.move_to_end(key)
        return self.store[key]

    def put(self, key: int, value: int) -> None:
        if key in self.store:
            self.store.move_to_end(key)
        self.store[key] = value
        if len(self.store) > self.cap:
            self.store.popitem(last=False)`,
    language: "python",
    complexity: { time: "O(1) per op", space: "O(capacity)" },
  },
];
