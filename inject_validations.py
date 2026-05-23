import os
import re

# Directorio de las páginas
pages_dir = r"c:\TrabajosU\Proyecto Angular\frontend-logistica\src\app\pages"

def process_html_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Buscar el nombre del formulario, ej: #conductorForm="ngForm"
    form_name_match = re.search(r'#(\w+)="ngForm"', content)
    if not form_name_match:
        return
    form_name = form_name_match.group(1)

    # Remover [disabled]="formName.invalid" de los botones submit
    content = re.sub(rf'\[disabled\]="{form_name}\.invalid"', '', content)

    # Agregar los mensajes de error
    # Buscamos divs con clase form-group
    # Luego buscamos el input/select con name="X"
    
    # Patrón para encontrar bloques form-group
    # No es perfecto usar regex para HTML, pero para nuestro formato estructurado funcionará.
    # Mejor procesamos línea por línea.
    
    lines = content.split('\n')
    new_lines = []
    
    in_form_group = False
    current_name = None
    has_validation = False
    
    for i, line in enumerate(lines):
        if 'class="form-group"' in line:
            in_form_group = True
            current_name = None
            has_validation = False
            
        if in_form_group:
            # Buscar name="..."
            name_match = re.search(r'name="([^"]+)"', line)
            if name_match:
                current_name = name_match.group(1)
            
            # Buscar si tiene validaciones
            if re.search(r'\b(required|minlength|maxlength|pattern|min|max)\b', line):
                has_validation = True
                
            # Si estamos cerrando el form-group, inyectar el error
            if '</div>' in line and in_form_group:
                if current_name and has_validation:
                    # Chequear si ya existe un mensaje de error para no duplicar
                    if "text-danger" not in "".join(lines[max(0, i-5):i]):
                        error_msg = f'            <small *ngIf="{form_name}.controls[\'{current_name}\']?.invalid && {form_name}.controls[\'{current_name}\']?.touched" class="text-danger" style="color: #ef4444; font-weight: 600; font-size: 0.8rem; margin-top: 4px; display: block;">❌ Campo obligatorio o inválido.</small>'
                        # Insertar antes del </div> (asumiendo que </div> está solo o al final de la línea)
                        line = line.replace('</div>', error_msg + '\n          </div>')
                in_form_group = False
                
        new_lines.append(line)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    print(f"Processed: {os.path.basename(filepath)} with form {form_name}")

for root, dirs, files in os.walk(pages_dir):
    for file in files:
        if file.endswith('.html'):
            process_html_file(os.path.join(root, file))
