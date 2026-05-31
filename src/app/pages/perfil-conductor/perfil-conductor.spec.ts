import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PerfilConductor } from './perfil-conductor';

describe('PerfilConductor', () => {
  let component: PerfilConductor;
  let fixture: ComponentFixture<PerfilConductor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilConductor],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilConductor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
