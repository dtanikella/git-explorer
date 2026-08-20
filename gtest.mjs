import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
// two quads linked by one edge — the Phase-1 hierarchy fixture
const g = new Graph();
['a','b','c','d','e','f','g','h'].forEach(n=>g.addNode(n));
[['a','b'],['a','c'],['a','d'],['b','c'],['b','d'],['c','d'],['e','f'],['e','g'],['e','h'],['f','g'],['f','h'],['g','h'],['d','e']].forEach(p=>g.addEdge(p[0],p[1],{weight:1}));
const r1 = louvain(g, {resolution: 1.0});
const r2 = louvain(g, {resolution: 1.0});
console.log('same:', JSON.stringify(r1)===JSON.stringify(r2), JSON.stringify(r1));
