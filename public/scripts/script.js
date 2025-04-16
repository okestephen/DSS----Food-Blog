function addIngredient() {
  const list = document.getElementById("ingredientsList");
  const input = document.createElement("div");
  input.innerHTML = `<input type="text" name="ingredients[]" required>
                     <button type="button" class="remove-btn" onclick="removeField(this)">Remove</button>`;
  list.appendChild(input);
}

function addStep() {
  const list = document.getElementById("stepsList");
  const input = document.createElement("div");
  input.innerHTML = `<input type="text" name="steps[]" required>
                     <button type="button" class="remove-btn" onclick="removeField(this)">Remove</button>`;
  list.appendChild(input);
}

function removeField(button) {
  button.parentElement.remove();
}