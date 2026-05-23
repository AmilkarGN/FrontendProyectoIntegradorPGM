import os
import re

pages_dir = r"c:\TrabajosU\Proyecto Angular\frontend-logistica\src\app\pages"

def process_html_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the form definition: <form (ngSubmit)="guardarAlgo()" #formName="ngForm">
    # We want to replace (ngSubmit)="functionCall()" with (ngSubmit)="formName.invalid ? formName.control.markAllAsTouched() : functionCall()"
    
    # We will search for all <form> tags
    lines = content.split('\n')
    new_lines = []
    modified = False
    
    for line in lines:
        if '<form' in line and '(ngSubmit)="' in line and '#str' not in line: # avoid replacing already modified or weird ones
            # Extract form name
            form_name_match = re.search(r'#(\w+)="ngForm"', line)
            if form_name_match:
                form_name = form_name_match.group(1)
                
                # Extract the ngSubmit content
                ng_submit_match = re.search(r'\(ngSubmit\)="([^"]+)"', line)
                if ng_submit_match:
                    submit_content = ng_submit_match.group(1)
                    
                    # Check if it's already modified
                    if 'markAllAsTouched' not in submit_content:
                        new_submit = f"{form_name}.invalid ? {form_name}.control.markAllAsTouched() : {submit_content}"
                        line = line.replace(f'(ngSubmit)="{submit_content}"', f'(ngSubmit)="{new_submit}"')
                        modified = True
                        
        new_lines.append(line)

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print(f"Modified forms in {os.path.basename(filepath)}")

for root, dirs, files in os.walk(pages_dir):
    for file in files:
        if file.endswith('.html'):
            process_html_file(os.path.join(root, file))
