// Moving an existing iframe in the DOM can reload it. Leave the tree untouched
// when the effective preset order has not changed.
export function synchronizeComponentOrder(container, orderedContainers) {
  const current = [...container.children];
  if (current.length === orderedContainers.length && current.every((node, index) => node === orderedContainers[index]))
    return false;
  for (const node of orderedContainers) container.appendChild(node);
  return true;
}
