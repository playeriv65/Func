// Sample JavaScript file
const data = [
    { name: "Alice", age: 25 },
    { name: "Bob", age: 30 },
    { name: "Charlie", age: 28 }
];

function processData(items) {
    return items.map(item => ({
        ...item,
        category: item.age > 27 ? "Senior" : "Junior"
    }));
}

console.log(processData(data));
