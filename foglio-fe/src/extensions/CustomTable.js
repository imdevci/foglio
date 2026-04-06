import { Table, TableView } from '@tiptap/extension-table';

export class CustomTableView extends TableView {
  constructor(node, cellMinWidth, view, getPos, editor) {
    super(node, cellMinWidth);
    this.view = view;
    this.getPos = getPos;
    this.editor = editor || view?.editor;

    this.dom.classList.add('editor-table-wrapper');

    // Create Table Toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'editor-table-toolbar';
    this.toolbar.contentEditable = 'false';

    // Tag / Label
    const tag = document.createElement('div');
    tag.className = 'editor-table-tag';
    tag.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v18"/>
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M3 15h18"/>
      </svg>
      <span>Table</span>
    `;

    // Actions container
    const actions = document.createElement('div');
    actions.className = 'editor-table-actions';

    // Edit Table Button
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-table-btn';
    editBtn.title = 'Edit Table';
    editBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v18"/>
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M3 15h18"/>
      </svg>
      <span>Edit Table</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    `;

    // Dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'edit-table-dropdown';
    dropdown.style.display = 'none';

    dropdown.innerHTML = `
      <div class="edit-table-dropdown-header">
        <span>Table Options</span>
      </div>
      <div class="edit-table-dropdown-section">
        <span class="edit-table-section-title">Columns</span>
        <div class="edit-table-row-btns">
          <button type="button" class="edit-table-item-btn add-col-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Column
          </button>
          <button type="button" class="edit-table-item-btn delete-btn del-col-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            Column
          </button>
        </div>
      </div>
      <div class="edit-table-dropdown-section">
        <span class="edit-table-section-title">Rows</span>
        <div class="edit-table-row-btns">
          <button type="button" class="edit-table-item-btn add-row-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Row
          </button>
          <button type="button" class="edit-table-item-btn delete-btn del-row-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            Row
          </button>
        </div>
      </div>
      <div class="dropdown-divider"></div>
      <button type="button" class="edit-table-item-btn delete-table-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        Delete Table
      </button>
    `;

    const getEditor = () => this.editor || this.view?.editor;

    const ensureTableFocus = () => {
      const ed = getEditor();
      if (ed) {
        if (!ed.isActive('table')) {
          const pos = typeof this.getPos === 'function' ? this.getPos() : this.view?.posAtDOM(this.dom, 0);
          if (typeof pos === 'number' && pos >= 0) {
            ed.commands.focus(pos + 2);
          } else {
            ed.commands.focus();
          }
        }
      } else if (this.view) {
        this.view.focus();
      }
    };

    editBtn.onmousedown = (e) => e.preventDefault();
    editBtn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'block';
      document.querySelectorAll('.edit-table-dropdown').forEach((d) => {
        d.style.display = 'none';
      });
      dropdown.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        ensureTableFocus();
      }
    };

    const addColBtn = dropdown.querySelector('.add-col-btn');
    addColBtn.onmousedown = (e) => e.preventDefault();
    addColBtn.onclick = (e) => {
      e.stopPropagation();
      ensureTableFocus();
      const ed = getEditor();
      if (ed) ed.chain().focus().addColumnAfter().run();
      dropdown.style.display = 'none';
    };

    const delColBtn = dropdown.querySelector('.del-col-btn');
    delColBtn.onmousedown = (e) => e.preventDefault();
    delColBtn.onclick = (e) => {
      e.stopPropagation();
      ensureTableFocus();
      const ed = getEditor();
      if (ed) ed.chain().focus().deleteColumn().run();
      dropdown.style.display = 'none';
    };

    const addRowBtn = dropdown.querySelector('.add-row-btn');
    addRowBtn.onmousedown = (e) => e.preventDefault();
    addRowBtn.onclick = (e) => {
      e.stopPropagation();
      ensureTableFocus();
      const ed = getEditor();
      if (ed) ed.chain().focus().addRowAfter().run();
      dropdown.style.display = 'none';
    };

    const delRowBtn = dropdown.querySelector('.del-row-btn');
    delRowBtn.onmousedown = (e) => e.preventDefault();
    delRowBtn.onclick = (e) => {
      e.stopPropagation();
      ensureTableFocus();
      const ed = getEditor();
      if (ed) ed.chain().focus().deleteRow().run();
      dropdown.style.display = 'none';
    };

    const delTableBtn = dropdown.querySelector('.delete-table-btn');
    delTableBtn.onmousedown = (e) => e.preventDefault();
    delTableBtn.onclick = (e) => {
      e.stopPropagation();
      ensureTableFocus();
      const ed = getEditor();
      if (ed) ed.chain().focus().deleteTable().run();
      dropdown.style.display = 'none';
    };

    actions.appendChild(editBtn);
    actions.appendChild(dropdown);

    this.toolbar.appendChild(tag);
    this.toolbar.appendChild(actions);

    this.dom.insertBefore(this.toolbar, this.table);

    this.onDocClick = (e) => {
      if (!this.toolbar.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', this.onDocClick);
  }

  stopEvent(event) {
    if (this.toolbar && this.toolbar.contains(event.target)) {
      return true;
    }
    return false;
  }

  destroy() {
    if (this.onDocClick) {
      document.removeEventListener('click', this.onDocClick);
    }
  }
}

export const CustomTable = Table.extend({
  addNodeView() {
    return ({ node, view, getPos, editor }) => {
      return new CustomTableView(node, this.options.cellMinWidth, view, getPos, editor);
    };
  },
});
